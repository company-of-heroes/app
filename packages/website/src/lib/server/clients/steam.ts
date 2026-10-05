import { ResultAsync } from 'neverthrow';
import { upstream } from '../errors';
import type { Task } from '../result';

export type SteamPlayerSummary = {
	steamid: string;
	personaname?: string;
	avatar?: string;
	avatarmedium?: string;
	avatarfull?: string;
	timecreated?: number;
	loccountrycode?: string;
	profileurl?: string;
	lastlogoff?: number;
	personastate?: number;
	gameextrainfo?: string;
};

export type SteamPlaytime = { playtime_forever?: number; playtime_2weeks?: number };

export type SteamBans = { vacBans: number; gameBans: number; daysSinceLastBan: number };

/** Largest available avatar. */
export function avatarOf(summary: SteamPlayerSummary | undefined): string {
	return summary?.avatarfull || summary?.avatarmedium || summary?.avatar || '';
}

/**
 * Steam Web API. Without an API key every call returns nothing (features degrade,
 * pages still load); failures yield an empty result too, so these tasks never fail.
 */
export class SteamClient {
	constructor(
		private readonly fetch: typeof globalThis.fetch,
		private readonly apiKey: string
	) {}

	get configured(): boolean {
		return Boolean(this.apiKey);
	}

	/** Summaries by Steam id; batches of 100 (the API maximum). */
	playerSummaries(steamIds: string[]): Task<Map<string, SteamPlayerSummary>> {
		return ResultAsync.fromSafePromise(this.loadSummaries(steamIds));
	}

	/** Recent playtime (minutes) for one app, or null when private/unknown. */
	recentPlaytime(steamId: string, appId: number): Task<SteamPlaytime | null> {
		return ResultAsync.fromSafePromise(this.loadPlaytime(steamId, appId));
	}

	/** VAC and game bans, or null when the account has none (or the lookup failed). */
	playerBans(steamId: string): Task<SteamBans | null> {
		return ResultAsync.fromSafePromise(this.loadBans(steamId));
	}

	/**
	 * A raw Web API call for the desktop app (which no longer ships the key), e.g.
	 * `ISteamUser/GetPlayerSummaries/v2`. Callers whitelist the path and parameters.
	 */
	call(path: string, params: Record<string, string>): Task<unknown> {
		return ResultAsync.fromPromise(
			(async () => {
				const query = new URLSearchParams({ ...params, key: this.apiKey });
				const response = await this.fetch(`https://api.steampowered.com/${path}/?${query}`);
				if (!response.ok) {
					throw new Error(`Steam API ${path} failed (${response.status})`);
				}

				return (await response.json()) as unknown;
			})(),
			(error) => {
				console.warn('[steam] proxy call failed', error);
				return upstream('Steam API request failed');
			}
		);
	}

	private async loadSummaries(steamIds: string[]): Promise<Map<string, SteamPlayerSummary>> {
		const summaries = new Map<string, SteamPlayerSummary>();
		const unique = [...new Set(steamIds)];
		if (!this.apiKey || unique.length === 0) {
			return summaries;
		}

		for (let i = 0; i < unique.length; i += 100) {
			const params = new URLSearchParams({
				key: this.apiKey,
				steamids: unique.slice(i, i + 100).join(',')
			});
			try {
				const response = await this.fetch(
					`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?${params}`
				);
				if (!response.ok) {
					continue;
				}

				const data = (await response.json()) as { response?: { players?: SteamPlayerSummary[] } };
				for (const player of data.response?.players ?? []) {
					summaries.set(player.steamid, player);
				}
			} catch (error) {
				console.warn('[steam] player summaries failed', error);
			}
		}
		return summaries;
	}

	private async loadBans(steamId: string): Promise<SteamBans | null> {
		if (!this.apiKey) {
			return null;
		}

		try {
			const params = new URLSearchParams({ key: this.apiKey, steamids: steamId });
			const response = await this.fetch(
				`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?${params}`
			);
			if (!response.ok) {
				return null;
			}

			const data = (await response.json()) as {
				players?: {
					NumberOfVACBans?: number;
					NumberOfGameBans?: number;
					DaysSinceLastBan?: number;
				}[];
			};
			const bans = data.players?.[0];
			const vacBans = Number(bans?.NumberOfVACBans ?? 0);
			const gameBans = Number(bans?.NumberOfGameBans ?? 0);
			if (vacBans + gameBans === 0) {
				return null;
			}

			return { vacBans, gameBans, daysSinceLastBan: Number(bans?.DaysSinceLastBan ?? 0) };
		} catch {
			return null;
		}
	}

	private async loadPlaytime(steamId: string, appId: number): Promise<SteamPlaytime | null> {
		if (!this.apiKey) {
			return null;
		}

		try {
			const params = new URLSearchParams({ key: this.apiKey, steamid: steamId });
			const response = await this.fetch(
				`https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?${params}`
			);
			if (!response.ok) {
				return null;
			}

			const data = (await response.json()) as {
				response?: { games?: ({ appid: number } & SteamPlaytime)[] };
			};
			return data.response?.games?.find((game) => Number(game.appid) === appId) ?? null;
		} catch {
			return null;
		}
	}
}
