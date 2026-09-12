import type { LobbyPlayer, Match as LobbyMatch } from '@fknoobs/app';
import type { Player as ReplayPlayer } from '@fknoobs/replay-parser';
import type { LiveLobby, LiveLobbyPlayer } from '@company-of-heroes/ui/live-lobby';
import { isOccupiedLiveLobbyPlayer } from '@company-of-heroes/ui/live-lobby';
import { toMatchListRowFromLiveLobby } from '@company-of-heroes/ui/match';
import type { MatchExpanded } from '$core/app/database/matches';
import type { ReplaysExpanded } from '$core/app/database/replays';
import { Race, getString } from '$lib/utils/game';
import { raceFromReplayFaction } from '$lib/utils/replay-doctrine';
export type MatchViewResultPlayer = {
	profile_id: number;
	steamId?: string;
	outcome?: number;
	oldrating?: number;
	newrating?: number;
};

export type MatchViewResult = {
	startgametime?: number;
	completiontime?: number;
	description?: string;
	matchtype_id?: number;
	players?: MatchViewResultPlayer[];
};

export type MatchView = {
	id: string;
	source: 'lobby' | 'replay' | 'live';
	map: string;
	mapLabel?: string;
	players: LobbyPlayer[];
	createdAt: string;
	durationSeconds?: number | null;
	result?: MatchViewResult | LobbyMatch | null;
	title?: string;
	isRanked?: boolean;
	needsResult?: boolean;
	sessionId?: number;
	lobbyId?: string | null;
	hostName?: string;
	modeLabel?: string;
	likeCount?: number;
	downloadCount?: number;
	commentCount?: number;
	hasReplay?: boolean;
	replay?: unknown;
	alliesOutcome?: 'win' | 'loss';
	axisOutcome?: 'win' | 'loss';
};

function isMatchView(value: unknown): value is MatchView {
	if (typeof value !== 'object' || value === null || !('source' in value)) {
		return false;
	}

	const source = (value as MatchView).source;
	return source === 'lobby' || source === 'replay' || source === 'live';
}

function isReplayExpanded(value: unknown): value is ReplaysExpanded {
	return typeof value === 'object' && value !== null && 'mapFilename' in value;
}

function mapBasename(mapFilename: string): string {
	return mapFilename.split(/[/\\]/).pop() || mapFilename;
}

function durationFromResult(result: LobbyMatch | null | undefined): number | null {
	if (!result?.startgametime || !result?.completiontime) {
		return null;
	}

	const seconds = result.completiontime - result.startgametime;
	return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function resolveDurationSeconds(match: MatchExpanded): number | null {
	const stored = match.durationSeconds;
	if (typeof stored === 'number' && Number.isFinite(stored) && stored > 0) {
		return stored;
	}

	return durationFromResult(match.result as LobbyMatch | null | undefined);
}

function profileFromAlias(alias: string, profileId: number) {
	return {
		alias,
		profile_id: profileId,
		name: alias,
		personal_statgroup_id: 0,
		xp: 0,
		level: 0,
		leaderboardregion_id: 0,
		country: ''
	};
}

function replayPlayerToLobby(player: ReplayPlayer, index: number): LobbyPlayer {
	const race = raceFromReplayFaction(player.faction || '');
	const playerId = typeof player.id === 'number' ? player.id : index;
	const name = player.name || undefined;
	const isAllies = race === Race.US || race === Race.Commonwealth;

	return {
		index,
		playerId,
		type: 0,
		team: isAllies ? 0 : 1,
		race,
		name,
		slot: player.slot,
		steamId: player.steamId || undefined,
		profile: name ? profileFromAlias(name, playerId) : undefined
	};
}

function livePlayerToLobby(player: LiveLobbyPlayer): LobbyPlayer {
	const alias = player.alias.trim();
	const profileId = player.profileId ?? (player.playerId > 0 ? player.playerId : 0);
	const isAllies = player.race === Race.US || player.race === Race.Commonwealth;
	const team =
		player.team === 0 || player.team === 1 ? player.team : isAllies ? 0 : 1;

	return {
		index: player.index,
		playerId: player.playerId,
		type: player.type ?? 0,
		team,
		race: player.race,
		name: alias || undefined,
		steamId: player.steamId || undefined,
		profile: alias ? profileFromAlias(alias, profileId || player.index) : undefined
	};
}

export function fromMatchExpanded(match: MatchExpanded): MatchView {
	const durationSeconds = resolveDurationSeconds(match);

	return {
		id: match.id,
		source: 'lobby',
		map: match.map,
		players: match.players ?? [],
		createdAt: match.createdAt,
		durationSeconds,
		result: match.result,
		title: match.title,
		isRanked: match.isRanked,
		needsResult: match.needsResult,
		sessionId: match.sessionId,
		lobbyId: match.id,
		likeCount: match.likeCount,
		downloadCount: match.downloadCount,
		commentCount: match.commentCount,
		hasReplay: match.hasReplay,
		replay: match.replay,
		alliesOutcome: match.alliesOutcome,
		axisOutcome: match.axisOutcome
	};
}

export function fromReplayExpanded(replay: ReplaysExpanded): MatchView {
	const players = (replay.players ?? []).map((player, index) =>
		replayPlayerToLobby(player, index)
	);

	return {
		id: replay.id,
		source: 'replay',
		map: mapBasename(replay.mapFilename || ''),
		mapLabel: replay.mapName ? getString(replay.mapName) : undefined,
		players,
		createdAt: replay.gameDate || replay.createdAt,
		durationSeconds: replay.durationInSeconds,
		result: null,
		title: replay.title,
		isRanked: replay.isRanked,
		likeCount: replay.likeCount,
		downloadCount: replay.downloadCount,
		commentCount: replay.commentCount
	};
}

export function fromLiveLobby(lobby: LiveLobby): MatchView {
	const players = lobby.players.filter(isOccupiedLiveLobbyPlayer).map(livePlayerToLobby);

	return {
		id: lobby.id,
		source: 'live',
		map: lobby.map,
		players,
		createdAt: lobby.createdAt,
		result: null,
		isRanked: lobby.isRanked,
		lobbyId: lobby.lobbyId ?? null,
		hostName: lobby.hostName,
		modeLabel: lobby.modeLabel
	};
}

function lobbyPlayerToListPlayer(player: LobbyPlayer): LiveLobbyPlayer {
	return {
		index: player.index,
		playerId: player.playerId,
		type: player.type,
		race: player.race,
		team: player.team,
		alias: player.profile?.alias || player.name || '',
		profileId: player.profile?.profile_id ?? (player.playerId > 0 ? player.playerId : null),
		steamId: player.steamId ?? null,
		stats: player.stats ?? null
	};
}

function ratingChangeForMatch(
	match: MatchExpanded,
	profileId?: string | number | null,
	steamIds?: string[]
): number | null {
	const players = match.result?.players;
	if (!players?.length) {
		return null;
	}

	const id = profileId != null && profileId !== '' ? Number(profileId) : NaN;
	const entry = Number.isFinite(id)
		? players.find((player) => player.profile_id === id)
		: steamIds?.length
			? players.find((player) => steamIds.includes(player.steamId))
			: undefined;

	if (
		!entry ||
		!Number.isFinite(entry.newrating) ||
		!Number.isFinite(entry.oldrating)
	) {
		return null;
	}

	return entry.newrating - entry.oldrating;
}

/** Map a saved lobby match to the shared ui MatchListRow shape. */
export function toUiMatchListRow(
	match: MatchExpanded,
	options: {
		profileId?: string | number | null;
		steamIds?: string[];
		modeLabel?: string;
	} = {}
): import('@company-of-heroes/ui/match').MatchListRow {
	const durationSeconds = resolveDurationSeconds(match);

	return {
		id: match.id,
		map: match.map,
		modeLabel: options.modeLabel,
		createdAt: match.createdAt,
		players: (match.players ?? []).map(lobbyPlayerToListPlayer),
		durationSeconds,
		ratingChange: ratingChangeForMatch(match, options.profileId, options.steamIds),
		alliesOutcome: resolveTeamOutcome(match, 'allies'),
		axisOutcome: resolveTeamOutcome(match, 'axis'),
		lobbyId: match.id,
		sessionId: match.sessionId,
		isRanked: match.isRanked
	};
}

export function liveLobbyToUiMatchListRow(lobby: LiveLobby) {
	return toMatchListRowFromLiveLobby(lobby);
}

export function toMatchView(input: MatchView | MatchExpanded | ReplaysExpanded): MatchView {
	if (isMatchView(input)) {
		return input;
	}

	if (isReplayExpanded(input)) {
		return fromReplayExpanded(input);
	}

	return fromMatchExpanded(input);
}

function isAlliesPlayer(player: LobbyPlayer) {
	if (player.team === 0 || player.team === 1) {
		return player.team === 0;
	}

	return player.race === Race.US || player.race === Race.Commonwealth;
}

/** Win/loss for a side from precomputed fields or Relic result players. */
export function resolveTeamOutcome(
	row: {
		players?: LobbyPlayer[];
		result?: { players?: MatchViewResultPlayer[] } | null;
		alliesOutcome?: 'win' | 'loss';
		axisOutcome?: 'win' | 'loss';
	},
	team: 'allies' | 'axis'
): 'win' | 'loss' | undefined {
	const precomputed = team === 'allies' ? row.alliesOutcome : row.axisOutcome;
	if (precomputed) {
		return precomputed;
	}

	const resultPlayers = row.result?.players;
	if (!resultPlayers?.length || !row.players?.length) {
		return undefined;
	}

	const sidePlayers = row.players.filter((player) =>
		team === 'allies' ? isAlliesPlayer(player) : !isAlliesPlayer(player)
	);
	const player = resultPlayers.find((resultPlayer) =>
		sidePlayers.some((sidePlayer) => sidePlayer.playerId === resultPlayer.profile_id)
	);

	if (!player || player.outcome === undefined) {
		return undefined;
	}

	return player.outcome === 0 ? 'loss' : 'win';
}

export type MatchInput = MatchView | MatchExpanded | ReplaysExpanded;
