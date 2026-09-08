import type { LobbyPlayer } from '@fknoobs/app';
import { groupBy } from 'lodash-es';
import { t } from '$lib/i18n';

export const MATCH_TYPES = {
	0: 'Basic Match',
	1: '1 VS. 1',
	2: '2 VS. 2',
	3: '3 VS. 3',
	4: '4 VS. 4',
	5: '2 VS. 2 AT',
	6: '3 VS. 3 AT',
	7: '4 VS. 4 AT',
	8: 'Operation: Assault 2v2',
	9: 'Operation: Assault 2v2 AT',
	10: 'Operation: Assault 3v3 AT',
	11: 'Operation: Panzerkrieg 2v2',
	12: 'Operation: Panzerkrieg 2v2 AT',
	13: 'Operation: Panzerkrieg 3v3 AT',
	14: 'Skirmish',
	15: 'Operation: Assault',
	16: 'Operation: Panzerkrieg',
	17: 'Operation: Stonewall'
} as const;

export type MatchTypeId = keyof typeof MATCH_TYPES;

const LIVE_GAME_FORMS = new Set(['AutoMatchForm', 'GameSetupForm']);

export function isLiveGameForm(form: string): boolean {
	return LIVE_GAME_FORMS.has(form);
}

const LOG_FACTION_RACE: Record<string, number> = {
	allies: 0,
	axis: 1,
	allies_commonwealth: 2,
	axis_panzer_elite: 3
};

/** Maps `MOD - Setting player (N) race to: allies` (and sibling faction names) to Race 0–3. */
export function raceFromLogFaction(faction: string): number | null {
	const race = LOG_FACTION_RACE[faction.trim().toLowerCase()];
	return race == null ? null : race;
}

/** Allies / Commonwealth → team 0, Axis / Panzer Elite → team 1. */
export function teamFromRace(race: number): number {
	return race === 0 || race === 2 ? 0 : 1;
}

/**
 * Relic logs closed/empty slots as Id -1 with Type 3 or 6.
 * Real skirmish AI is Id -1 with Type 1. Replay placeholders use Id 0 and
 * stay in the local roster here; live publish uses the stricter shared
 * filter in `@company-of-heroes/ui/live-lobby/slim` (rejects Id 0).
 */
export function isOccupiedLobbySlot(player: { playerId: number; type: number }): boolean {
	if (player.playerId === -1) {
		return player.type === 1;
	}

	return true;
}

/** Last path segment of `DATA:scenarios\mp\classic\4p_duclair\4p_duclair`. */
export function mapFromScenarioPath(scenario: string): string {
	const trimmed = scenario.replace(/^['"]|['"]$/g, '').trim();
	const parts = trimmed.split(/[/\\]/);
	return parts[parts.length - 1] || trimmed;
}

export type ReplayHeaderPlayer = {
	name: string;
	faction: string;
	steamId?: string;
};

function normalizeMapKey(value: string): string {
	return value.toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** True when the log only had a slot label (`Player 1`) and no rec/Relic name. */
export function isPlaceholderPlayerName(name: string | undefined): boolean {
	if (!name?.trim()) return true;
	return /^player\s+\d+$/i.test(name.trim());
}

export function replayMapsMatch(lobbyMap: string | undefined, recMapFileName: string): boolean {
	if (!lobbyMap?.trim() || !recMapFileName?.trim()) return false;
	const lobbyKey = normalizeMapKey(mapFromScenarioPath(lobbyMap));
	if (!lobbyKey) return false;
	const recKey = normalizeMapKey(mapFromScenarioPath(recMapFileName));
	return recKey === lobbyKey || normalizeMapKey(recMapFileName).includes(lobbyKey);
}

function raceFromRecFaction(faction: string): number | null {
	return raceFromLogFaction(faction);
}

export function replayFactionsMatch(
	lobbyPlayers: { race: number }[],
	recPlayers: ReplayHeaderPlayer[]
): boolean {
	if (lobbyPlayers.length === 0 || lobbyPlayers.length !== recPlayers.length) return false;
	const lobbyRaces = lobbyPlayers.map((player) => player.race).sort((a, b) => a - b);
	const recRaces: number[] = [];
	for (const player of recPlayers) {
		const race = raceFromRecFaction(player.faction);
		if (race == null) return false;
		recRaces.push(race);
	}
	recRaces.sort((a, b) => a - b);
	return lobbyRaces.every((race, i) => race === recRaces[i]);
}

export function replayHeaderMatchesLobby(
	lobby: { map?: string; players: { race: number }[] },
	rec: { mapFileName: string; players: ReplayHeaderPlayer[] }
): boolean {
	return replayMapsMatch(lobby.map, rec.mapFileName) && replayFactionsMatch(lobby.players, rec.players);
}

/** Copies rec names onto log placeholder slots, matching race then index. */
export function assignReplayNames(
	lobbyPlayers: { index: number; race: number; name?: string; steamId?: string }[],
	recPlayers: ReplayHeaderPlayer[]
): boolean {
	if (!replayFactionsMatch(lobbyPlayers, recPlayers)) return false;
	const used = new Set<number>();
	const slots = [...lobbyPlayers].sort((a, b) => a.index - b.index);
	for (const player of slots) {
		const byIndex = recPlayers[player.index];
		let recIndex = -1;
		if (
			byIndex &&
			!used.has(player.index) &&
			raceFromRecFaction(byIndex.faction) === player.race
		) {
			recIndex = player.index;
		} else {
			recIndex = recPlayers.findIndex(
				(rec, i) => !used.has(i) && raceFromRecFaction(rec.faction) === player.race
			);
		}
		if (recIndex < 0) return false;
		used.add(recIndex);
		const rec = recPlayers[recIndex];
		const recName = rec.name?.trim();
		if (recName && isPlaceholderPlayerName(player.name)) {
			player.name = recName;
		}
		if (rec.steamId && !player.steamId) {
			player.steamId = rec.steamId;
		}
	}
	return true;
}

/** Negative, non-zero id so replay upserts satisfy sessionId without colliding with Relic ids. */
export function syntheticReplaySessionId(startedAt: string | null | undefined): number {
	const source = startedAt?.trim() || 'replay';
	let hash = 2166136261;
	for (let i = 0; i < source.length; i++) {
		hash ^= source.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return -((hash >>> 0) % 1_000_000_000 || 1);
}

export function currentLogTimestamp(): string {
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.00`;
}

/** Stable per-match id for deduping lobby.joined / lobby.started publishes. */
export function lobbyPublishKey(lobby: {
	sessionId?: number | null;
	startedAt?: string | null;
}): string | null {
	if (lobby.sessionId == null && !lobby.startedAt) {
		return null;
	}

	return `${lobby.sessionId ?? ''}:${lobby.startedAt ?? ''}`;
}

export type Match = {
	sessionId: number;
	startedAt: string;
	map: string;
	players: LobbyPlayer[];
	teams: { teamId: number; players: LobbyPlayer[] }[];
	outcome?: string;
	didNotify: boolean;
	started: boolean;
	ended?: boolean;
	isRanked: boolean;
	isReplay?: boolean;
	outcomeFormatted: string;
	matchType: MatchTypeId;
	isSkirmish: boolean;
	type: string;
	mapName: string;
	me?: LobbyPlayer;
};

/**
 * Represents a Company of Heroes lobby/match session built up from log events.
 *
 * Pure domain model: it has no dependency on the app context. The local
 * player's Steam ID is injected by the log session so `me` can be resolved.
 */
export class Lobby {
	sessionId: number | null = null;
	startedAt: string | null = null;
	map?: string;
	players: LobbyPlayer[] = [];
	outcome?: string;
	didNotify = false;
	started = false;
	ended = false;
	isRanked = false;
	isReplay = false;
	/**
	 * Relic match type from `Setting match type to N` / automatch search.
	 * Skirmish / CLASSIC_COOP is 14 — required when AI slots are missing from the log.
	 */
	logMatchType: number | null = null;

	/** Steam ID of the local player, injected by the log session. */
	localSteamId: string | undefined;

	constructor(startedAt: string, isRanked: boolean, isReplay = false) {
		this.startedAt = startedAt;
		this.isRanked = isRanked;
		this.isReplay = isReplay;
	}

	get outcomeFormatted(): string {
		if (!this.outcome) return t('Unknown');

		switch (this.outcome) {
			case 'PS_WON':
				return t('Won');
			case 'PS_LOST':
				return t('Lost');
			case 'PS_ABORTED':
				return t('Aborted');
			default:
				return t('Unknown');
		}
	}

	get matchType(): MatchTypeId {
		if (this.isSkirmish) {
			return 14;
		}

		if (this.logMatchType != null && this.logMatchType in MATCH_TYPES) {
			return this.logMatchType as MatchTypeId;
		}

		if (!this.isRanked) {
			return 0;
		}

		const humans = this.players.filter((player) => player.playerId !== -1);
		if (humans.length === 2) {
			return 1;
		}

		if (humans.length === 4) {
			return 2;
		}

		if (humans.length === 6) {
			return 3;
		}

		if (humans.length === 8) {
			return 4;
		}

		return 0;
	}

	get isSkirmish(): boolean {
		if (this.logMatchType === 14) {
			return true;
		}

		return this.players.some((player) => player.playerId === -1);
	}

	get teams() {
		return Object.entries(groupBy(this.players, 'team')).map(([teamId, players]) => ({
			teamId: Number(teamId),
			players
		}));
	}

	get type(): string {
		return t(MATCH_TYPES[this.matchType] ?? 'Custom Game');
	}

	get mapName(): string {
		if (!this.map) return t('Unknown Map');

		const match = this.map.match(/^(\d+)p_(.+)$/);
		if (!match) {
			return this.map.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
		}

		const [, playerCount, mapNameWithoutPrefix] = match;
		const formattedName = mapNameWithoutPrefix
			.replace(/_/g, ' ')
			.replace(/\b\w/g, (c) => c.toUpperCase());

		return `${formattedName} (${playerCount})`;
	}

	/** The local player, resolved via the injected Steam ID. */
	get me(): LobbyPlayer | undefined {
		if (!this.players?.length || !this.localSteamId) {
			return undefined;
		}

		return (
			this.players.find((p) => p.steamId === this.localSteamId) ??
			this.players.find((p) => p.profile?.name?.endsWith(this.localSteamId!))
		);
	}

	addPlayer(player: LobbyPlayer) {
		if (!isOccupiedLobbySlot(player)) {
			this.removePlayer(player.index);
			return;
		}

		const existing = this.players.find((p) => p.index === player.index);
		if (existing) {
			if (existing.playerId !== player.playerId) {
				existing.profile = undefined;
				existing.matchHistory = undefined;
				existing.steamId = undefined;
			}
			existing.playerId = player.playerId;
			existing.type = player.type;
			// Keep a resolved faction when a later Populate still has Race 6 (random).
			const incomingRace = player.race;
			const resolved =
				existing.race >= 0 && existing.race <= 3 && (incomingRace < 0 || incomingRace > 3);
			if (!resolved) {
				existing.race = incomingRace;
			}
			// Relic Team is authoritative for Allies/Axis columns (especially skirmish).
			existing.team = player.team;
			if (player.name) existing.name = player.name;
			return;
		}

		this.players.push(player);
	}

	removePlayer(index: number) {
		this.players = this.players.filter((player) => player.index !== index);
	}

	pruneEmptySlots() {
		this.players = this.players.filter(isOccupiedLobbySlot);
	}

	/**
	 * Retrieves a player by their lobby slot number. The game assigns slots
	 * in team-interleaved order, hence the per-size mappings.
	 * Use max player index (map size), not occupied count — 3v4 skirmish still
	 * uses the 8-slot layout even with an empty human slot.
	 */
	getPlayerBySlot(slot: number): LobbyPlayer | null {
		const mappings: Record<number, number[]> = {
			8: [0, 2, 4, 6, 1, 3, 5, 7],
			6: [0, 2, 4, 1, 3, 5],
			4: [0, 2, 1, 3],
			2: [0, 1]
		};

		const maxIndex = this.players.reduce((max, player) => Math.max(max, player.index), -1);
		const sizeHint = Math.max(this.players.length, maxIndex + 1);
		const padded = sizeHint <= 2 ? 2 : sizeHint <= 4 ? 4 : sizeHint <= 6 ? 6 : 8;
		const mapping = mappings[padded];

		if (!mapping) {
			return this.players.find((player) => player.index === slot) ?? null;
		}

		const index = mapping.indexOf(slot);

		if (index === -1) {
			return null;
		}

		return this.players.find((player) => player.index === index) ?? null;
	}

	/** Player IDs excluding CPU players. */
	getPlayerIds(): number[] {
		return this.players.map((player) => player.playerId).filter((id) => id !== -1);
	}

	getPlayerById(playerId: number): LobbyPlayer | undefined {
		return this.players.find((player) => player.playerId === playerId);
	}

	applyReplayPlayerNames(recPlayers: ReplayHeaderPlayer[]): boolean {
		return assignReplayNames(this.players, recPlayers);
	}

	toJSON(): Match {
		return {
			sessionId: this.sessionId!,
			startedAt: this.startedAt!,
			map: this.map!,
			players: this.players,
			teams: this.teams,
			outcome: this.outcome,
			didNotify: this.didNotify,
			started: this.started,
			ended: this.ended,
			isRanked: this.isRanked,
			isReplay: this.isReplay,
			outcomeFormatted: this.outcomeFormatted,
			matchType: this.matchType,
			isSkirmish: this.isSkirmish,
			type: this.type,
			mapName: this.mapName,
			me: this.me
		};
	}
}
