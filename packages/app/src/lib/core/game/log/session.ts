import Emittery from 'emittery';
import type { TransformedMatch } from '@fknoobs/app';
import { Lobby } from '../lobby';
import type { TriggerEvent, TriggerEvents } from './parser';

/**
 * Lobby session state machine.
 *
 * Consumes parsed trigger events and produces high-level domain events.
 * External lookups (Relic/Steam profiles) are injected so the machine is
 * fully testable without network or Tauri.
 */

export type RelicProfileLike = {
	profile_id: number;
	name: string;
	alias: string;
	[key: string]: unknown;
};

export type SessionDeps = {
	getProfileBySteamId(steamId: string): Promise<RelicProfileLike | null | undefined>;
	getSteamProfile(steamId: string): Promise<unknown | null>;
	getProfileByIds(ids: number[]): Promise<RelicProfileLike[]>;
	getRecentMatchHistoryForProfile(profileId: number): Promise<TransformedMatch[]>;
};

export type SessionEvents = {
	authenticated: { steamId: string; relicProfile: unknown; steamProfile: unknown };
	logout: undefined;
	'lobby.joined': Lobby;
	'lobby.started': Lobby;
	'lobby.gameover': Lobby;
	'lobby.destroyed': Lobby;
	'lobby.result': { playerId: number; result: 'PS_WON' | 'PS_KILLED' };
};

export class LogSession extends Emittery<SessionEvents> {
	lobby: Lobby | undefined;
	sessionId: number | null = null;
	localSteamId: string | undefined;

	#deps: SessionDeps;

	constructor(deps: SessionDeps) {
		super();
		this.#deps = deps;
	}

	/** Resets all session state (log truncated / watcher restarted). */
	reset(): void {
		this.lobby = undefined;
		this.sessionId = null;
	}

	async handle(event: TriggerEvent): Promise<void> {
		switch (event.type) {
			case 'LOG:FOUND:PROFILE':
				return this.#onFoundProfile(event.data);
			case 'LOG:LOBBY:POPULATING':
				return this.#onPopulating(event.data);
			case 'LOG:LOBBY:POPULATING:PLAYER':
				return this.#onPlayer(event.data);
			case 'LOG:LOBBY:POPULATING:PLAYER:STEAM':
				return this.#onPlayerSteam(event.data);
			case 'LOG:LOBBY:POPULATING:MAP':
				return this.#onMap(event.data);
			case 'LOG:LOBBY:SESSIONID':
				return this.#onSessionId(event.data);
			case 'LOG:LOBBY:STARTED':
				return this.#onStarted();
			case 'LOG:LOBBY:PLAYER:RESULT':
				return this.#onResult(event.data);
			case 'LOG:LOBBY:GAMEOVER':
				return this.#onGameOver();
			case 'LOG:LOBBY:DESTROYED':
				return this.#onDestroyed();
			case 'LOG:ENDED':
				return this.#onEnded();
			default:
				return;
		}
	}

	async #onFoundProfile({ steamId }: TriggerEvents['LOG:FOUND:PROFILE']): Promise<void> {
		try {
			const [relicProfile, steamProfile] = await Promise.all([
				this.#deps.getProfileBySteamId(steamId),
				this.#deps.getSteamProfile(steamId)
			]);

			if (relicProfile && steamProfile) {
				this.localSteamId = steamId;

				if (this.lobby) {
					this.lobby.localSteamId = steamId;
				}

				await this.emitSerial('authenticated', { steamId, relicProfile, steamProfile });
			}
		} catch (error) {
			console.error('[LOG]: Failed to resolve profile for', steamId, error);
		}
	}

	async #onPopulating({
		startedAt,
		isRanked
	}: TriggerEvents['LOG:LOBBY:POPULATING']): Promise<void> {
		this.lobby = new Lobby(startedAt.trim(), isRanked === 'AutoMatchForm');
		this.lobby.localSteamId = this.localSteamId;

		await this.emitSerial('lobby.joined', this.lobby);
	}

	#onPlayer(data: TriggerEvents['LOG:LOBBY:POPULATING:PLAYER']): void {
		this.lobby?.addPlayer({
			index: data.index,
			playerId: data.playerId,
			type: data.type,
			race: data.race,
			team: data.team
		});
	}

	#onPlayerSteam({
		ranking,
		slot,
		steamId
	}: TriggerEvents['LOG:LOBBY:POPULATING:PLAYER:STEAM']): void {
		const player = this.lobby?.getPlayerBySlot(slot);

		if (player) {
			player.steamId = steamId.toString();
			player.ranking = ranking;
			player.slot = slot;
		}
	}

	#onMap({ map }: TriggerEvents['LOG:LOBBY:POPULATING:MAP']): void {
		if (this.lobby) {
			this.lobby.map = map;
		}
	}

	#onSessionId({ sessionId }: TriggerEvents['LOG:LOBBY:SESSIONID']): void {
		this.sessionId = sessionId;
	}

	async #onStarted(): Promise<void> {
		if (!this.lobby) return;

		const profileIds = this.lobby.getPlayerIds();

		if (profileIds.length === 0) return;

		try {
			const profiles = await this.#deps.getProfileByIds(profileIds);

			this.lobby.players.forEach((player) => {
				player.profile = profiles.find(
					(profile) => profile.profile_id === player.playerId
				) as typeof player.profile;
			});
		} catch (error) {
			console.error('[LOG]: Failed to resolve lobby player profiles:', error);
		}

		await this.#attachMatchHistory();

		this.lobby.sessionId = this.sessionId;
		this.lobby.started = true;

		await this.emitSerial('lobby.started', this.lobby);
	}

	async #attachMatchHistory(): Promise<void> {
		if (!this.lobby) {
			return;
		}

		await Promise.all(
			this.lobby.players.map(async (player) => {
				const profileId = player.profile?.profile_id;

				if (!profileId) {
					player.matchHistory = [];
					return;
				}

				try {
					player.matchHistory = await this.#deps.getRecentMatchHistoryForProfile(profileId);
				} catch (error) {
					console.error('[LOG]: Failed to fetch match history for', profileId, error);
					player.matchHistory = [];
				}
			})
		);
	}

	async #onResult({ playerId, result }: TriggerEvents['LOG:LOBBY:PLAYER:RESULT']): Promise<void> {
		await this.emitSerial('lobby.result', { playerId, result });
	}

	async #onGameOver(): Promise<void> {
		if (this.lobby) {
			await this.emitSerial('lobby.gameover', this.lobby);
		}
	}

	async #onDestroyed(): Promise<void> {
		if (this.lobby) {
			await this.emitSerial('lobby.destroyed', this.lobby);
		}

		this.lobby = undefined;
		this.sessionId = null;
	}

	async #onEnded(): Promise<void> {
		await this.emitSerial('logout');
	}
}
