import type { MatchExpanded } from '$core/app/database/matches';
import { replayHeaderMatchesLobby, type Match, type ReplayHeaderPlayer } from '$core/game/lobby';
import { app } from '$core/app/context';
import { account } from '$core/account';
import { Feature } from '../feature.svelte';
import { relic, relicLeaderboardFingerprint } from '$lib/relic';
import { join } from '@tauri-apps/api/path';
import { exists, readDir, readFile, stat } from '@tauri-apps/plugin-fs';
import { parseHeader, parseReplay, type ReplayData } from '@fknoobs/replay-parser';
import { download } from '@tauri-apps/plugin-upload';
import { Matches } from './matches.svelte';
import { extractPlayerRatingSnapshotsFromLobby, type PlayerEloMap } from '$lib/utils/player-elo';
import { ingestPlayerRatings } from '$core/pocketbase/player-ratings';
import { toPersistablePlayers } from '$core/game/lobby-utils';
import { embedSteamIdsInReplay } from '$lib/utils/replay-steam-ids';
import { getFile } from '$core/pocketbase';
import { t } from '$lib/i18n';

const POLL_INITIAL_MS = 10_000;
const POLL_MAX_MS = 60_000;
const PROFILE_REFRESH_DELAYS_MS = [15_000, 30_000, 45_000, 60_000, 90_000, 120_000];
const REPLAY_NAME_SCAN_LIMIT = 50;
const TEMP_REC_RETRY_ATTEMPTS = 3;
const TEMP_REC_RETRY_DELAY_MS = 400;

type HistorySettings = {
	enabled: boolean;
	pendingReplaySessionId: number | null;
};

/**
 * Saves finished matches (with replay) and fills in their results from the
 * Relic API.
 *
 * Result polling is on-demand: it only runs while matches with
 * `needsResult=true` exist and backs off when results take a while, instead
 * of polling unconditionally forever.
 */
export class History extends Feature<HistorySettings> {
	name = 'history';

	matches!: Matches;

	#pollTimer: ReturnType<typeof setTimeout> | null = null;
	#pollDelay = POLL_INITIAL_MS;
	#profileRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	#profileRefreshDelays: number[] = [];
	#unsubscribers: (() => void)[] = [];
	#disposeMatches: (() => void) | null = null;

	override async register(): Promise<this> {
		this.#ensureMatches();
		return super.register();
	}

	override async destroy(): Promise<void> {
		this.#disposeMatches?.();
		this.#disposeMatches = null;
		await super.destroy();
	}

	#ensureMatches(): void {
		if (this.#disposeMatches) {
			return;
		}

		// Matches sets up reactive watchers/resources in its constructor, so it
		// must be created inside an effect root (register() runs outside one).
		this.#disposeMatches = $effect.root(() => {
			this.matches = new Matches();
		});
	}

	enable() {
		this.#ensureMatches();

		this.#unsubscribers.push(
			app.on('lobby.destroyed', ({ match, replay }) => {
				if (match.isReplay) {
					return;
				}

				void this.saveLobbyResult(match, replay?.file ?? null);
				this.#scheduleProfileRefresh(PROFILE_REFRESH_DELAYS_MS);
			}),
			app.on('lobby.started', (match) => {
				if (match.isReplay) {
					return;
				}

				this.#setPendingSessionId(match.sessionId);
				void this.#harvestPlayerRatings(match);
			}),
			app.on('game.login', () => {
				// Catch up on pending results as soon as we know the player.
				this.#schedulePoll(0);
			})
		);

		this.#schedulePoll(0);
		void this.#recoverPendingReplay();
	}

	disable() {
		this.#stopPolling();
		this.#stopProfileRefresh();

		for (const unsubscribe of this.#unsubscribers) {
			unsubscribe();
		}

		this.#unsubscribers = [];
	}

	#setPendingSessionId(sessionId: number | null | undefined): void {
		if (sessionId == null || !Number.isFinite(sessionId) || sessionId <= 0) {
			return;
		}

		this.settings.pendingReplaySessionId = sessionId;
	}

	#clearPendingSessionId(sessionId?: number | null): void {
		const pending = this.settings.pendingReplaySessionId;
		if (pending == null) {
			return;
		}

		if (sessionId != null && pending !== sessionId) {
			return;
		}

		this.settings.pendingReplaySessionId = null;
	}

	async #recoverPendingReplay(): Promise<void> {
		const sessionId = this.settings.pendingReplaySessionId;
		if (sessionId == null || !account.userId) {
			return;
		}

		try {
			const existing = await app.database.matches.findBySessionId(sessionId);
			const local = await this.getLastMatchReplay();
			if (!local?.file) {
				return;
			}

			if (!existing) {
				return;
			}

			const result = await app.database.matches.attachReplay(existing.id, local.file);
			if (result.attached || (result.keptExisting && result.replaySize >= local.file.size)) {
				this.#clearPendingSessionId(sessionId);
			}
		} catch (error) {
			console.warn('[HISTORY]: pending replay recovery failed:', error);
		}
	}

	async #harvestPlayerRatings(match: Match): Promise<void> {
		if (!app.isReady || !account.userId) {
			return;
		}

		const snapshots = extractPlayerRatingSnapshotsFromLobby(match.players);
		if (snapshots.length === 0) {
			return;
		}

		try {
			const records = await ingestPlayerRatings(snapshots);
			if (records.length === 0) {
				return;
			}

			const bySteamId = new Map(records.map((record) => [record.steamId, record.elo]));
			this.#attachStoredElo(match, bySteamId);

			if (app.lobby && app.lobby.sessionId === match.sessionId) {
				this.#attachStoredElo(app.lobby, bySteamId);
				app.lobby = { ...app.lobby, players: [...app.lobby.players] };
			}
		} catch (error) {
			console.warn('[HISTORY]: player ratings harvest failed:', error);
		}
	}

	#attachStoredElo(match: Match, bySteamId: Map<string, PlayerEloMap>): void {
		for (const player of match.players) {
			if (!player.steamId) {
				continue;
			}

			const storedElo = bySteamId.get(player.steamId);
			if (storedElo) {
				player.storedElo = storedElo;
			}
		}
	}

	/**
	 * Updates the durable match row created by the lobbies_live PocketBase hook.
	 * Does not create lobbies rows — the hook is the sole writer.
	 */
	async saveLobbyResult(lobby: Match, replayFile: File | null = null): Promise<void> {
		if (lobby.isReplay || !lobby.sessionId || !account.userId) {
			return;
		}

		this.#setPendingSessionId(lobby.sessionId);

		try {
			let existing = await this.#findDurableMatch(lobby.sessionId);
			if (!existing) {
				console.error('[HISTORY]: durable match missing for session', lobby.sessionId);
				app.toast.error(t('Could not save match result. The match record was not found.'));
				return;
			}

			const players = toPersistablePlayers(lobby.players);
			const needsResult = !lobby.isSkirmish;
			const payload = {
				isRanked: lobby.isRanked,
				title: lobby.type,
				map: lobby.map || 'Unknown',
				needsResult,
				players,
				// Reopen fill budget after the match ends — attempts must not
				// count while the durable row was still linked from lobbies_live.
				...(needsResult ? { hasFailed: false, resultAttempts: 0 } : {})
			};

			try {
				existing = await app.database.matches.update(existing.id, payload);
			} catch (error) {
				// Non-owners cannot update metadata; file attach still works below.
				console.warn('[HISTORY]: match metadata update skipped:', error);
			}

			if (replayFile) {
				try {
					const result = await app.database.matches.attachReplay(existing.id, replayFile);
					if (
						result.attached ||
						(result.keptExisting && result.replaySize >= replayFile.size)
					) {
						this.#clearPendingSessionId(lobby.sessionId);
					}
				} catch (error) {
					console.error('[HISTORY]: failed to attach replay:', error);
				}
			}

			const match = await app.database.matches.getById(existing.id).catch(() => existing);
			app.emit('lobby.saved', match);
			this.#schedulePoll(POLL_INITIAL_MS);
		} catch (error) {
			console.error('[HISTORY]: failed to save match:', error);
			app.toast.error(t('Could not save match result.'));
		}
	}

	/** Waits briefly for the PB hook to create/link the durable row. */
	async #findDurableMatch(sessionId: number) {
		const attempts = 5;
		const delayMs = 400;

		for (let attempt = 0; attempt < attempts; attempt++) {
			const existing = await app.database.matches.findBySessionId(sessionId);
			if (existing) {
				return existing;
			}

			if (attempt < attempts - 1) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		return null;
	}

	#schedulePoll(delay: number): void {
		if (this.#pollTimer) {
			clearTimeout(this.#pollTimer);
		}

		this.#pollDelay = delay > 0 ? delay : POLL_INITIAL_MS;

		this.#pollTimer = setTimeout(() => void this.#poll(), delay);
	}

	#stopPolling(): void {
		if (this.#pollTimer) {
			clearTimeout(this.#pollTimer);
			this.#pollTimer = null;
		}

		this.#pollDelay = POLL_INITIAL_MS;
	}

	#stopProfileRefresh(): void {
		if (this.#profileRefreshTimer) {
			clearTimeout(this.#profileRefreshTimer);
			this.#profileRefreshTimer = null;
		}

		this.#profileRefreshDelays = [];
	}

	#scheduleProfileRefresh(delays: number[]): void {
		this.#stopProfileRefresh();
		this.#profileRefreshDelays = [...delays];
		this.#queueNextProfileRefresh();
	}

	#queueNextProfileRefresh(): void {
		const delay = this.#profileRefreshDelays.shift();
		if (delay == null) {
			return;
		}

		this.#profileRefreshTimer = setTimeout(() => void this.#runProfileRefresh(), delay);
	}

	async #runProfileRefresh(): Promise<void> {
		this.#profileRefreshTimer = null;
		await this.#refreshRelicProfile();
		this.#queueNextProfileRefresh();
	}

	async #refreshRelicProfile(): Promise<void> {
		const existing = app.game.profile;
		const steamId = existing?.steam.steamid ?? app.game.steamId;
		if (!existing || !steamId) {
			return;
		}

		try {
			const relicProfile = await relic.getProfileBySteamId(steamId);
			if (!relicProfile) {
				return;
			}

			const previous = relicLeaderboardFingerprint(existing.relic.leaderboardStats);
			const next = relicLeaderboardFingerprint(relicProfile.leaderboardStats);
			if (previous === next) {
				return;
			}

			app.game.profile = { relic: relicProfile, steam: existing.steam };
		} catch (error) {
			console.warn('[HISTORY]: relic profile refresh failed:', error);
		}
	}

	async #poll(): Promise<void> {
		this.#pollTimer = null;

		try {
			const pending = await this.#fillPendingResults();

			if (pending === 0) {
				// Nothing to do: stay idle until the next match is saved.
				this.#stopPolling();
				return;
			}

			// Results pending: retry with backoff.
			this.#schedulePoll(Math.min(this.#pollDelay * 2, POLL_MAX_MS));
		} catch (error) {
			console.warn('[HISTORY]: result poll failed:', error);
			this.#schedulePoll(Math.min(this.#pollDelay * 2, POLL_MAX_MS));
		}
	}

	/**
	 * Fetches results for matches that still need one.
	 * Returns the number of matches still pending afterwards.
	 */
	async #fillPendingResults(): Promise<number> {
		const profileId = app.game.profile?.relic.profile_id;

		if (!profileId) {
			return 0;
		}

		const needingResults = await app.database.matches.getPaginated(1, 100, {
			filter: `needsResult=true && hasFailed!=true && user = "${account.userId}"`,
			expand: false
		});

		if (needingResults.items.length === 0) {
			return 0;
		}

		const recentMatches = await relic.getRecentMatchHistoryForProfile(profileId, {
			includeHidden: true
		});
		let pending = needingResults.items.length;

		for (const item of needingResults.items) {
			const result = recentMatches.find((m) => m.id === item.sessionId);

			if (!result) {
				continue;
			}

			try {
				const update: {
					needsResult: false;
					result: typeof result;
					replay?: File;
				} = {
					needsResult: false,
					result
				};

				if (item.replay) {
					try {
						const bytes = await getFile(item, item.replay);
						const withSteamIds = embedSteamIdsInReplay(bytes, result.players);
						update.replay = new File([withSteamIds], item.replay);
					} catch (error) {
						console.warn(
							'[HISTORY]: failed to embed Steam IDs into replay for match',
							item.id,
							error
						);
					}
				}

				const updated = await app.database.matches.update(item.id, update);
				app.emit('match.result', updated);
				void this.#refreshRelicProfile();

				pending--;
			} catch (error) {
				console.warn('[HISTORY]: failed to store result for match', item.id, error);
			}
		}

		return pending;
	}

	/**
	 * Finds player names for an in-game replay. Relic GameHistory logs have
	 * factions and map but no aliases; those live in the `.rec` header.
	 */
	async findReplayHeaderPlayers(lobby: {
		map?: string;
		players: { race: number }[];
	}): Promise<ReplayHeaderPlayer[] | null> {
		if (!lobby.map || lobby.players.length === 0) {
			return null;
		}

		const bytes = await this.#findLocalReplayBytes(lobby);
		if (bytes) {
			try {
				return parseHeader(bytes).players;
			} catch (error) {
				console.warn('[HISTORY]: failed to parse matched replay header:', error);
			}
		}

		return this.#findStoredReplayHeader(lobby);
	}

	/**
	 * Fully parses the playback `.rec` that matches an in-game replay lobby
	 * (doctrines, CPM actions, duration). Header-only name attach stays on
	 * {@link findReplayHeaderPlayers}.
	 */
	async findPlaybackReplay(lobby: {
		map?: string;
		players: { race: number }[];
	}): Promise<ReplayData | null> {
		if (!lobby.map || lobby.players.length === 0) {
			return null;
		}

		const bytes = await this.#findLocalReplayBytes(lobby);
		if (!bytes) {
			return null;
		}

		try {
			return parseReplay(bytes);
		} catch (error) {
			console.warn('[HISTORY]: failed to parse playback replay:', error);
			return null;
		}
	}

	async #findLocalReplayBytes(lobby: {
		map?: string;
		players: { race: number }[];
	}): Promise<Uint8Array | null> {
		let playbackDir: string;
		try {
			playbackDir = await app.paths.cohPlaybackDir();
		} catch (error) {
			console.warn('[HISTORY]: could not resolve playback folder', error);
			return null;
		}

		let names: string[] = [];
		try {
			const entries = await readDir(playbackDir);
			const recs: { name: string; mtime: number }[] = [];
			for (const entry of entries) {
				if (!entry.isFile || !entry.name.toLowerCase().endsWith('.rec')) {
					continue;
				}

				const path = await join(playbackDir, entry.name);
				let mtime = 0;
				try {
					const info = await stat(path);
					mtime = info.mtime?.getTime() ?? info.birthtime?.getTime() ?? 0;
				} catch {
					mtime = 0;
				}
				recs.push({ name: entry.name, mtime });
			}
			recs.sort((a, b) => b.mtime - a.mtime);
			names = recs.slice(0, REPLAY_NAME_SCAN_LIMIT).map((rec) => rec.name);
		} catch (error) {
			console.warn('[HISTORY]: could not list playback folder', error);
			return null;
		}

		for (const name of names) {
			try {
				const bytes = new Uint8Array(await readFile(await join(playbackDir, name)));
				const header = parseHeader(bytes);
				if (replayHeaderMatchesLobby(lobby, header)) {
					return bytes;
				}
			} catch (error) {
				console.warn('[HISTORY]: skipped replay header', name, error);
			}
		}

		return null;
	}

	async #findStoredReplayHeader(lobby: {
		map?: string;
		players: { race: number }[];
	}): Promise<ReplayHeaderPlayer[] | null> {
		const mapKey = lobby.map?.trim();
		const userId = account.userId;
		if (!mapKey || !userId) {
			return null;
		}

		const escapedMap = mapKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		const escapedUser = userId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		try {
			const result = await app.database.replays.getPaginated(1, 30, {
				filter: `createdBy = "${escapedUser}" && mapFilename ~ "${escapedMap}"`,
				sort: '-gameDate',
				fields: ['id', 'mapFilename', 'players', 'gameDate']
			});
			for (const record of result.items) {
				const recPlayers = (record.players ?? []) as ReplayHeaderPlayer[];
				if (
					replayHeaderMatchesLobby(lobby, {
						mapFileName: record.mapFilename,
						players: recPlayers
					})
				) {
					return recPlayers;
				}
			}
		} catch (error) {
			console.warn('[HISTORY]: stored replay lookup failed', error);
		}
		return null;
	}

	/** Reads the replay of the last finished match from the playback folder. */
	async getLastMatchReplay(): Promise<{
		file: File;
		replay: ReplayData | null;
	} | null> {
		let lastError: unknown = null;

		for (let attempt = 0; attempt < TEMP_REC_RETRY_ATTEMPTS; attempt++) {
			try {
				const path = await join(await app.paths.cohPlaybackDir(), 'temp.rec');
				if (!(await exists(path))) {
					if (attempt < TEMP_REC_RETRY_ATTEMPTS - 1) {
						await new Promise((resolve) => setTimeout(resolve, TEMP_REC_RETRY_DELAY_MS));
						continue;
					}

					return null;
				}

				const fileData = await readFile(path);
				if (!fileData || fileData.byteLength < 64) {
					if (attempt < TEMP_REC_RETRY_ATTEMPTS - 1) {
						await new Promise((resolve) => setTimeout(resolve, TEMP_REC_RETRY_DELAY_MS));
						continue;
					}

					return null;
				}

				let replay: ReplayData | null = null;
				try {
					replay = parseReplay(new Uint8Array(fileData));
				} catch (error) {
					console.warn(
						'[HISTORY]: parseReplay failed; uploading raw temp.rec bytes:',
						error
					);
				}

				return {
					file: new File([new Uint8Array(fileData)], 'replay.rec'),
					replay
				};
			} catch (error) {
				lastError = error;
				if (attempt < TEMP_REC_RETRY_ATTEMPTS - 1) {
					await new Promise((resolve) => setTimeout(resolve, TEMP_REC_RETRY_DELAY_MS));
					continue;
				}
			}
		}

		if (lastError) {
			throw lastError;
		}

		return null;
	}

	async downloadReplay(match: MatchExpanded): Promise<{ ok: boolean; downloadCount?: number }> {
		try {
			const path = await join(await app.paths.cohPlaybackDir(), match.replay);
			const url = app.pocketbase.files.getURL(match, match.replay);

			await download(url, path);
			let downloadCount: number | undefined;
			try {
				downloadCount = await app.database.matchSocial.recordDownload(match.id);
			} catch (error) {
				console.warn('[HISTORY]: failed to record replay download:', error);
			}
			app.toast.success(t('Replay saved to the Company of Heroes playback folder.'));
			return { ok: true, downloadCount };
		} catch (error) {
			app.toast.error(
				t('Failed to download replay: {message}', {
					message: error instanceof Error ? error.message : String(error)
				})
			);
			return { ok: false };
		}
	}

	async downloadExists(match: MatchExpanded): Promise<boolean> {
		const path = await join(await app.paths.cohPlaybackDir(), match.replay);

		return await exists(path);
	}

	defaultSettings(): HistorySettings {
		return {
			enabled: true,
			pendingReplaySessionId: null
		};
	}
}

export const history = new History();
