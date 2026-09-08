import Emittery from 'emittery';
import type { TransformedMatch } from '@fknoobs/app';
import {
	currentLogTimestamp,
	isLiveGameForm,
	Lobby,
	mapFromScenarioPath,
	raceFromLogFaction,
	syntheticReplaySessionId,
	teamFromRace
} from '../lobby';
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
	'lobby.missionStarting': Lobby | undefined;
	'lobby.gameover': Lobby;
	'lobby.destroyed': Lobby;
	'lobby.result': { playerId: number; result: 'PS_WON' | 'PS_KILLED' };
};

export class LogSession extends Emittery<SessionEvents> {
	lobby: Lobby | undefined;
	sessionId: number | null = null;
	localSteamId: string | undefined;

	#deps: SessionDeps;
	#pendingReplayPlayers = new Map<number, { index: number; race: number; team: number }>();
	#pendingScenario: string | undefined;
	/** Ranked automatch mode from Trace / GetRequestInfoBySearchID (1–4). */
	#pendingAutomatchType: number | null = null;
	/** Custom / skirmish mode from GameSetupForm UpdateMatchType (0, 14, …). */
	#pendingGameSetupType: number | null = null;
	#didEnrichLiveHistory = false;

	constructor(deps: SessionDeps) {
		super();
		this.#deps = deps;
	}

	/** Resets all session state (log truncated / watcher restarted). */
	reset(): void {
		this.lobby = undefined;
		this.sessionId = null;
		this.#didEnrichLiveHistory = false;
		this.#pendingAutomatchType = null;
		this.#pendingGameSetupType = null;
		this.#clearReplayBuffer();
	}

	async handle(event: TriggerEvent): Promise<void> {
		switch (event.type) {
			case 'LOG:FOUND:PROFILE':
				return this.#onFoundProfile(event.data);
			case 'LOG:LOBBY:POPULATING':
				return this.#onPopulating(event.data);
			case 'LOG:LOBBY:POPULATING:PLAYER':
				return this.#onPlayer(event.data);
			case 'LOG:LOBBY:POPULATING:PLAYER:RACE':
				return this.#onPlayerRace(event.data);
			case 'LOG:LOBBY:POPULATING:SCENARIO':
				return this.#onScenario(event.data);
			case 'LOG:LOBBY:PLAYBACK':
				return this.#onPlayback();
			case 'LOG:LOBBY:POPULATING:PLAYER:STEAM':
				return this.#onPlayerSteam(event.data);
			case 'LOG:LOBBY:POPULATING:MATCH:TYPE':
				return this.#onMatchType(event.data);
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

	async #onPopulating({ startedAt, form }: TriggerEvents['LOG:LOBBY:POPULATING']): Promise<void> {
		const time = startedAt.trim();
		const isReplay = !isLiveGameForm(form);
		const isRanked = form === 'AutoMatchForm';

		if (this.lobby && this.#isSameLobby(time)) {
			this.lobby.isReplay = isReplay;
			this.lobby.isRanked = isRanked;
			this.#applyMatchTypeForForm(this.lobby, isRanked);
			if (!this.lobby.startedAt) this.lobby.startedAt = time;
			this.#resetLiveRoster(isReplay);
			return;
		}

		if (this.lobby && !this.lobby.started && !this.lobby.startedAt) {
			this.lobby.startedAt = time;
			this.lobby.isRanked = isRanked;
			this.lobby.isReplay = isReplay;
			this.lobby.sessionId = this.sessionId;
			this.lobby.localSteamId = this.localSteamId;
			this.#applyMatchTypeForForm(this.lobby, isRanked);
			this.#resetLiveRoster(isReplay);

			if (!isReplay) {
				await this.emitSerial('lobby.joined', this.lobby);
			}

			return;
		}

		this.lobby = new Lobby(time, isRanked, isReplay);
		this.lobby.localSteamId = this.localSteamId;
		this.lobby.sessionId = this.sessionId;
		this.#applyMatchTypeForForm(this.lobby, isRanked);

		if (!isReplay) {
			await this.emitSerial('lobby.joined', this.lobby);
		}
	}

	#isSameLobby(startedAt: string): boolean {
		if (!this.lobby) {
			return false;
		}

		// Only the Starting-game timestamp identifies a match. Matching on
		// sessionId alone treated the next match as a duplicate whenever
		// "APP -- Game Stop" was late, which skipped lobby.joined (and the
		// out-of-focus start notification sound).
		return this.lobby.startedAt === startedAt;
	}

	#ensureLobby(): Lobby {
		if (!this.lobby) {
			this.lobby = new Lobby('', false, false);
			this.lobby.localSteamId = this.localSteamId;
			this.lobby.sessionId = this.sessionId;
		}

		return this.lobby;
	}

	/**
	 * Replay support calls `#ensureLobby()` on pre-start `PopulateGameInfo` lines.
	 * Custom lobbies log closed slots there (often a 4p default map). Live
	 * `Starting game` used to keep that roster; drop it so the following
	 * player lines are the match that actually launched.
	 */
	#resetLiveRoster(isReplay: boolean): void {
		if (isReplay || !this.lobby || this.lobby.started) return;
		this.lobby.players = [];
		this.#didEnrichLiveHistory = false;
	}

	#clearReplayBuffer(): void {
		this.#pendingReplayPlayers.clear();
		this.#pendingScenario = undefined;
	}

	#applyPendingReplayPlayers(lobby: Lobby): void {
		for (const pending of this.#pendingReplayPlayers.values()) {
			lobby.addPlayer({
				index: pending.index,
				playerId: 0,
				type: 0,
				race: pending.race,
				team: pending.team,
				name: `Player ${pending.index + 1}`
			});
		}
	}

	#applyPendingMap(lobby: Lobby): void {
		if (lobby.map || !this.#pendingScenario) return;
		lobby.map = mapFromScenarioPath(this.#pendingScenario);
	}

	async #refreshStartedReplay(lobby: Lobby): Promise<void> {
		if (!lobby.started || !lobby.isReplay) {
			return;
		}

		await this.emitSerial('lobby.started', lobby);
	}

	async #onPlayer(data: TriggerEvents['LOG:LOBBY:POPULATING:PLAYER']): Promise<void> {
		const lobby = this.#ensureLobby();
		lobby.addPlayer({
			index: data.index,
			playerId: data.playerId,
			type: data.type,
			race: data.race,
			team: data.team,
			name: data.name?.trim() || undefined
		});
		await this.#refreshStartedReplay(lobby);
		await this.#enrichLiveIfNeeded(lobby);
	}

	#onPlayerRace({ index, faction }: TriggerEvents['LOG:LOBBY:POPULATING:PLAYER:RACE']): void {
		const label = faction.trim();
		if (/^\d+$/.test(label)) return;
		const race = raceFromLogFaction(label);
		if (race == null) return;
		this.#pendingReplayPlayers.set(index, { index, race, team: teamFromRace(race) });

		// Live skirmish often logs Race 6 (random) first, then resolves via this line.
		// Update race only — Relic Team from PopulateGameInfo owns Allies/Axis sides.
		if (this.lobby && !this.lobby.isReplay) {
			const player = this.lobby.players.find((entry) => entry.index === index);
			if (!player || player.race === race) {
				return;
			}

			player.race = race;
			if (this.lobby.started) {
				void this.emitSerial('lobby.started', this.lobby);
			}

			return;
		}

		if (!this.lobby?.isReplay) return;
		this.#applyPendingReplayPlayers(this.lobby);
		void this.#refreshStartedReplay(this.lobby);
	}

	/**
	 * Apply the match type that belongs to this form.
	 * Automatch uses Trace / GetRequestInfo (1–4); never keep a stale GameSetup BASIC_MATCH (0).
	 * Custom / skirmish uses GameSetupForm UpdateMatchType.
	 */
	#applyMatchTypeForForm(lobby: Lobby, isRanked: boolean): void {
		if (isRanked) {
			if (this.#pendingAutomatchType != null) {
				lobby.logMatchType = this.#pendingAutomatchType;
				return;
			}

			// Menu "Setting match type to 0: BASIC_MATCH" must not stick on ranked starts.
			if (lobby.logMatchType === 0) {
				lobby.logMatchType = null;
			}

			return;
		}

		if (this.#pendingGameSetupType != null) {
			lobby.logMatchType = this.#pendingGameSetupType;
		}
	}

	#onMatchType({ type }: TriggerEvents['LOG:LOBBY:POPULATING:MATCH:TYPE']): void {
		const isAutomatchMode = type >= 1 && type <= 4;

		if (isAutomatchMode) {
			this.#pendingAutomatchType = type;
		} else {
			this.#pendingGameSetupType = type;
		}

		const lobby = this.lobby;
		// Do not #ensureLobby() — menu GameSetup BASIC_MATCH would create an empty lobby
		// that AutoMatchForm later reuses with a polluted logMatchType of 0.
		if (!lobby || (!lobby.startedAt && !lobby.started)) {
			return;
		}

		if (lobby.isRanked !== isAutomatchMode) {
			return;
		}

		if (lobby.logMatchType === type) {
			return;
		}

		lobby.logMatchType = type;
		if (lobby.started) {
			void this.emitSerial('lobby.started', lobby);
		}
	}

	async #onScenario({ scenario }: TriggerEvents['LOG:LOBBY:POPULATING:SCENARIO']): Promise<void> {
		this.#pendingScenario = scenario;
		if (!this.lobby) return;
		this.#applyPendingMap(this.lobby);
		await this.#refreshStartedReplay(this.lobby);
	}

	#onPlayback(): void {
		const lobby = this.#ensureLobby();
		lobby.isReplay = true;
		if (!lobby.startedAt) {
			lobby.startedAt = currentLogTimestamp();
		}
		this.#applyPendingReplayPlayers(lobby);
		this.#applyPendingMap(lobby);
	}

	async #onPlayerSteam({
		ranking,
		slot,
		steamId
	}: TriggerEvents['LOG:LOBBY:POPULATING:PLAYER:STEAM']): Promise<void> {
		const player = this.lobby?.getPlayerBySlot(slot);

		if (!player) return;

		player.steamId = steamId.toString();
		player.ranking = ranking;
		player.slot = slot;

		if (this.lobby?.started && !this.lobby.isReplay) {
			await this.emitSerial('lobby.started', this.lobby);
		}
	}

	async #onMap({ map }: TriggerEvents['LOG:LOBBY:POPULATING:MAP']): Promise<void> {
		const lobby = this.#ensureLobby();
		lobby.map = map;
		await this.#refreshStartedReplay(lobby);
	}

	#onSessionId({ sessionId }: TriggerEvents['LOG:LOBBY:SESSIONID']): void {
		this.sessionId = sessionId;
	}

	async #onStarted(): Promise<void> {
		const lobby = this.#ensureLobby();

		if (lobby.isReplay && lobby.players.length === 0 && this.#pendingReplayPlayers.size > 0) {
			this.#applyPendingReplayPlayers(lobby);
		}
		this.#applyPendingMap(lobby);
		lobby.pruneEmptySlots();

		await this.emitSerial('lobby.missionStarting', lobby);

		if (lobby.started) return;

		if (!lobby.startedAt) {
			lobby.startedAt = currentLogTimestamp();
		}

		lobby.sessionId = this.sessionId ?? lobby.sessionId;
		if (!lobby.sessionId) {
			lobby.sessionId = syntheticReplaySessionId(lobby.startedAt);
		}

		const profileIds = lobby.getPlayerIds().filter((id) => id > 0);
		lobby.started = true;

		if (!lobby.isReplay && profileIds.length > 0) {
			await this.#enrichStartedLobby(lobby, profileIds);
			return;
		}

		await this.emitSerial('lobby.started', lobby);
	}

	async #enrichLiveIfNeeded(lobby: Lobby): Promise<void> {
		if (!lobby.started || lobby.isReplay || this.#didEnrichLiveHistory) return;
		const profileIds = lobby.getPlayerIds().filter((id) => id > 0);
		if (profileIds.length === 0) return;
		await this.#enrichStartedLobby(lobby, profileIds);
	}

	async #enrichStartedLobby(lobby: Lobby, profileIds: number[]): Promise<void> {
		this.#didEnrichLiveHistory = true;
		try {
			const profiles = await this.#deps.getProfileByIds(profileIds);

			lobby.players.forEach((player) => {
				player.profile = profiles.find(
					(profile) => profile.profile_id === player.playerId
				) as typeof player.profile;
			});
		} catch (error) {
			console.error('[LOG]: Failed to resolve lobby player profiles:', error);
		}

		await this.#attachMatchHistory(lobby);

		if (this.lobby !== lobby) {
			return;
		}

		await this.emitSerial('lobby.started', lobby);
	}

	async #attachMatchHistory(lobby: Lobby): Promise<void> {
		if (!lobby || lobby.isReplay) {
			return;
		}

		await Promise.all(
			lobby.players.map(async (player) => {
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
		if (!this.lobby) {
			return;
		}

		this.lobby.ended = true;
		await this.emitSerial('lobby.gameover', this.lobby);
	}

	async #onDestroyed(): Promise<void> {
		if (this.lobby) {
			await this.emitSerial('lobby.destroyed', this.lobby);
		}

		this.lobby = undefined;
		this.sessionId = null;
		this.#didEnrichLiveHistory = false;
		this.#clearReplayBuffer();
	}

	async #onEnded(): Promise<void> {
		await this.emitSerial('logout');
	}
}
