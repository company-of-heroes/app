import { PUBLIC_STEAM_API_KEY } from '$env/static/public';
import { fetch } from '$core/http/fetch';

// Types
export interface SteamPlayerSummary {
	steamid: string;
	communityvisibilitystate: number;
	profilestate: number;
	personaname: string;
	profileurl: string;
	avatar: string;
	avatarmedium: string;
	avatarfull: string;
	avatarhash: string;
	lastlogoff?: number;
	personastate: number;
	realname?: string;
	primaryclanid?: string;
	timecreated?: number;
	personastateflags?: number;
	loccountrycode?: string;
	locstatecode?: string;
	loccityid?: number;
	gameextrainfo?: string;
	gameid?: string;
	lobbysteamid?: string;
}

export interface SteamGame {
	appid: number;
	name: string;
	playtime_2weeks?: number;
	playtime_forever: number;
	img_icon_url: string;
	playtime_windows_forever?: number;
	playtime_mac_forever?: number;
	playtime_linux_forever?: number;
}

export interface RecentlyPlayedGamesResponse {
	total_count: number;
	games: SteamGame[];
}

export interface PlayerStats {
	steamID: string;
	gameName: string;
	stats: GameStat[];
	achievements: GameAchievement[];
}

export interface GameStat {
	name: string;
	value: number;
}

export interface GameAchievement {
	name: string;
	achieved: number;
}

export interface OwnedGamesResponse {
	game_count: number;
	games: SteamGame[];
}

export interface SteamBans {
	SteamId: string;
	CommunityBanned: boolean;
	VACBanned: boolean;
	NumberOfVACBans: number;
	DaysSinceLastBan: number;
	NumberOfGameBans: number;
	EconomyBan: string;
}

export class SteamAPIError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public endpoint?: string
	) {
		super(message);
		this.name = 'SteamAPIError';
	}
}

export class SteamAPI {
	private readonly baseUrl = 'https://api.steampowered.com';
	private cache = new Map<string, { data: any; timestamp: number }>();
	/** Per-steamId profile cache so batch fetches warm individual lookups. */
	private profileCache = new Map<string, { data: SteamPlayerSummary | null; timestamp: number }>();
	/** Profile lookups waiting to be sent as one GetPlayerSummaries call. */
	private profileQueue = new Map<string, ((profile: SteamPlayerSummary | null) => void)[]>();
	private profileFlushTimer: ReturnType<typeof setTimeout> | null = null;
	/** Set after a failed batch so a broken/rate-limited API is not hammered. */
	private profileBackoffUntil = 0;
	private readonly cacheDuration = 5 * 60 * 1000; // 5 minutes
	/** Collect lookups from a render pass before firing a request. */
	private readonly profileBatchWindow = 25;
	private readonly profileBatchSize = 100; // Steam's per-request limit
	private readonly profileBackoff = 30 * 1000;

	private get apiKey(): string {
		const key = PUBLIC_STEAM_API_KEY;
		if (!key) {
			throw new SteamAPIError('STEAM_API_KEY is not configured');
		}
		return key;
	}

	private getCacheKey(endpoint: string, params: Record<string, any>): string {
		return `${endpoint}:${JSON.stringify(params)}`;
	}

	private getFromCache<T>(key: string): T | null {
		const cached = this.cache.get(key);

		if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
			return cached.data as T;
		}
		this.cache.delete(key);
		return null;
	}

	private setCache(key: string, data: any): void {
		this.cache.set(key, { data, timestamp: Date.now() });
	}

	private getCachedProfile(steamId: string): SteamPlayerSummary | null | undefined {
		const cached = this.profileCache.get(steamId);
		if (!cached) return undefined;
		if (Date.now() - cached.timestamp >= this.cacheDuration) {
			this.profileCache.delete(steamId);
			return undefined;
		}
		return cached.data;
	}

	private setCachedProfile(steamId: string, data: SteamPlayerSummary | null): void {
		this.profileCache.set(steamId, { data, timestamp: Date.now() });
	}

	private rememberProfiles(profiles: SteamPlayerSummary[], requestedIds: string[]): void {
		const byId = new Map(profiles.map((profile) => [profile.steamid, profile]));
		for (const steamId of requestedIds) {
			this.setCachedProfile(steamId, byId.get(steamId) ?? null);
		}
	}

	/**
	 * Generic method to make Steam API requests
	 */
	private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
		const cacheKey = this.getCacheKey(endpoint, params);
		const cached = this.getFromCache<T>(cacheKey);

		if (cached) {
			return cached;
		}

		const url = new URL(`${this.baseUrl}${endpoint}`);
		url.searchParams.set('key', this.apiKey);

		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null) {
				url.searchParams.set(key, String(value));
			}
		}

		try {
			const response = await fetch(url.toString(), {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new SteamAPIError(
					`Steam API request failed: ${response.status} ${response.statusText}`.trim(),
					response.status,
					endpoint
				);
			}

			const data = await response.json();
			this.setCache(cacheKey, data);
			return data as T;
		} catch (error) {
			if (error instanceof SteamAPIError) {
				throw error;
			}
			throw new SteamAPIError(
				`Failed to fetch from Steam API: ${error instanceof Error ? error.message : 'Unknown error'}`,
				undefined,
				endpoint
			);
		}
	}

	/**
	 * Queue a profile lookup; every lookup made within the batch window is sent
	 * as a single GetPlayerSummaries request.
	 */
	private queueProfile(steamId: string): Promise<SteamPlayerSummary | null> {
		return new Promise((resolve) => {
			const waiting = this.profileQueue.get(steamId);

			if (waiting) {
				waiting.push(resolve);
				return;
			}

			this.profileQueue.set(steamId, [resolve]);
			this.scheduleProfileFlush();
		});
	}

	private scheduleProfileFlush(): void {
		if (this.profileFlushTimer !== null) {
			return;
		}

		this.profileFlushTimer = setTimeout(() => {
			this.profileFlushTimer = null;
			void this.flushProfileQueue();
		}, this.profileBatchWindow);
	}

	private async flushProfileQueue(): Promise<void> {
		const batch = [...this.profileQueue.keys()].slice(0, this.profileBatchSize);

		if (batch.length === 0) {
			return;
		}

		const waiters = batch.map((steamId) => [steamId, this.profileQueue.get(steamId)!] as const);
		for (const steamId of batch) {
			this.profileQueue.delete(steamId);
		}
		if (this.profileQueue.size > 0) {
			this.scheduleProfileFlush();
		}

		const byId = new Map<string, SteamPlayerSummary>();

		if (Date.now() >= this.profileBackoffUntil) {
			try {
				const data = await this.request<{ response: { players: SteamPlayerSummary[] } }>(
					'/ISteamUser/GetPlayerSummaries/v2/',
					{ steamids: batch.join(',') }
				);
				const profiles = data.response?.players ?? [];
				this.rememberProfiles(profiles, batch);
				for (const profile of profiles) {
					byId.set(profile.steamid, profile);
				}
			} catch (error) {
				this.profileBackoffUntil = Date.now() + this.profileBackoff;
				console.warn(
					`[STEAM]: profile batch of ${batch.length} failed, pausing lookups for ${this.profileBackoff / 1000}s:`,
					error
				);
			}
		}

		for (const [steamId, resolvers] of waiters) {
			const profile = byId.get(steamId) ?? null;
			for (const resolve of resolvers) {
				resolve(profile);
			}
		}
	}

	/**
	 * Get a Steam user profile by Steam ID
	 *
	 * @param steamId - The Steam ID (64-bit format) of the user
	 * @returns Steam player summary, or null when unknown or unavailable
	 */
	async getUserProfile(steamId: string): Promise<SteamPlayerSummary | null> {
		if (!steamId) return null;

		const cached = this.getCachedProfile(steamId);
		if (cached !== undefined) {
			return cached;
		}

		return this.queueProfile(steamId);
	}

	/**
	 * Get multiple Steam user profiles by Steam IDs
	 *
	 * @param steamIds - Array of Steam IDs, chunked into requests of 100
	 * @returns Array of Steam player summaries, omitting unavailable ones
	 */
	async getUserProfiles(steamIds: string[]): Promise<SteamPlayerSummary[]> {
		const uniqueIds = [...new Set(steamIds.filter(Boolean))];
		if (uniqueIds.length === 0) return [];

		const profiles = await Promise.all(uniqueIds.map((steamId) => this.getUserProfile(steamId)));
		return profiles.filter(Boolean) as SteamPlayerSummary[];
	}

	/**
	 * Get user stats for a specific game
	 *
	 * @param appId - The game's App ID
	 * @param steamId - The Steam ID of the user
	 * @returns Player stats for the game or null if not available
	 */
	async getUserStatsForGame(appId: number, steamId: string): Promise<PlayerStats | null> {
		try {
			const data = await this.request<{ playerstats: PlayerStats }>(
				'/ISteamUserStats/GetUserStatsForGame/v2/',
				{ appid: appId, steamid: steamId }
			);

			return data.playerstats ?? null;
		} catch (error) {
			// Stats might not be available for private profiles or games without stats
			console.warn(`Failed to get stats for app ${appId}, user ${steamId}:`, error);
			return null;
		}
	}

	/**
	 * Get recently played games for a user
	 *
	 * @param steamId - The Steam ID of the user
	 * @param count - Number of games to return (default: all)
	 * @returns Recently played games or null if not available
	 */
	async getRecentlyPlayedGames(
		steamId: string,
		count?: number
	): Promise<RecentlyPlayedGamesResponse | null> {
		try {
			const data = await this.request<{ response: RecentlyPlayedGamesResponse }>(
				'/IPlayerService/GetRecentlyPlayedGames/v1/',
				{ steamid: steamId, count }
			);

			return data.response ?? null;
		} catch (error) {
			console.error(`Failed to get recently played games for ${steamId}:`, error);
			return null;
		}
	}

	/**
	 * Get a specific recently played game by App ID for a user
	 *
	 * @param steamId - The Steam ID of the user
	 * @param appId - The App ID of the game
	 * @returns The SteamGame object or null if not found
	 */
	async getRecentlyPlayedGameByAppId(steamId: string, appId: number): Promise<SteamGame | null> {
		const recentlyPlayed = await this.getRecentlyPlayedGames(steamId);
		if (recentlyPlayed?.games) {
			return recentlyPlayed.games.find((game) => game.appid === appId) || null;
		}

		return null;
	}

	/**
	 * Get friend list for a user
	 *
	 * @param steamId - The Steam ID of the user
	 * @returns Array of friend Steam IDs or null if not available
	 */
	async getFriendList(steamId: string): Promise<string[] | null> {
		try {
			const data = await this.request<{ friendslist: { friends: { steamid: string }[] } }>(
				'/ISteamUser/GetFriendList/v1/',
				{ steamid: steamId, relationship: 'friend' }
			);
			return data.friendslist?.friends.map((friend) => friend.steamid) || null;
		} catch (error) {
			console.error(`Failed to get friend list for ${steamId}:`, error);
			return null;
		}
	}

	/**
	 * Get owned games for a user
	 *
	 * @param steamId - The Steam ID of the user
	 * @param includeAppInfo - Include game name and logo info
	 * @param includePlayedFreeGames - Include free games the user has played
	 * @returns Owned games or null if profile is private
	 */
	async getOwnedGames(
		steamId: string,
		includeAppInfo: boolean = true,
		includePlayedFreeGames: boolean = true
	): Promise<OwnedGamesResponse | null> {
		try {
			const data = await this.request<{ response: OwnedGamesResponse }>(
				'/IPlayerService/GetOwnedGames/v1/',
				{
					steamid: steamId,
					include_appinfo: includeAppInfo ? 1 : 0,
					include_played_free_games: includePlayedFreeGames ? 1 : 0
				}
			);

			return data.response ?? null;
		} catch (error) {
			console.error(`Failed to get owned games for ${steamId}:`, error);
			return null;
		}
	}

	/**
	 * Get player bans information
	 * @param steamId - The Steam ID of the user (or array of IDs)
	 * @returns Ban information
	 */
	async getPlayerBans(steamId: string | string[]): Promise<SteamBans[]> {
		const steamIds = Array.isArray(steamId) ? steamId.join(',') : steamId;

		try {
			const data = await this.request<{ players: SteamBans[] }>('/ISteamUser/GetPlayerBans/v1/', {
				steamids: steamIds
			});

			return data.players ?? [];
		} catch (error) {
			console.error('Failed to get player bans:', error);
			throw error;
		}
	}

	/**
	 * Get Steam level for a user
	 * @param steamId - The Steam ID of the user
	 * @returns Player level or null if not available
	 */
	async getSteamLevel(steamId: string): Promise<number | null> {
		try {
			const data = await this.request<{ response: { player_level: number } }>(
				'/IPlayerService/GetSteamLevel/v1/',
				{ steamid: steamId }
			);

			return data.response?.player_level ?? null;
		} catch (error) {
			console.error(`Failed to get Steam level for ${steamId}:`, error);
			return null;
		}
	}

	/**
	 * Concurrent players currently in a Steam app (Company of Heroes = 228200).
	 */
	async getCurrentPlayerCount(appId = 228200): Promise<number | null> {
		try {
			const data = await this.request<{
				response: { player_count: number; result: number };
			}>('/ISteamUserStats/GetNumberOfCurrentPlayers/v1/', { appid: appId });

			if (data.response?.result !== 1 || typeof data.response.player_count !== 'number') {
				return null;
			}

			return data.response.player_count;
		} catch (error) {
			console.error(`Failed to get current player count for app ${appId}:`, error);
			return null;
		}
	}

	/**
	 * Clear the cache
	 */
	clearCache(): void {
		this.cache.clear();
		this.profileCache.clear();
		this.profileBackoffUntil = 0;
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): { size: number; keys: string[] } {
		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys())
		};
	}
}

export const steam = new SteamAPI();
