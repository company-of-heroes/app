import { API_URL } from '$lib/site/urls';
import { unlocalizedPath } from '@company-of-heroes/i18n';
import type {
	CompareFilter,
	FilterOperator,
	HistoryMapOption,
	HistoryMatchup,
	HistorySortDir,
	HistorySortField,
	ReplaysQuery
} from '@company-of-heroes/ui/replay';

export type {
	CompareFilter,
	FilterOperator,
	HistoryMapOption,
	HistoryMatchup,
	HistoryPlayerOption,
	HistorySortDir,
	HistorySortField,
	ReplaysQuery
} from '@company-of-heroes/ui/replay';

export const REPLAYS_PER_PAGE = 30;
export const HOME_RECENT_MATCHES = 10;
export const HOME_RECENT_MEMBER_UPLOADS = 10;

export type ReplaysListTab = 'community' | 'member' | 'mine';

export function parseReplaysTab(search: URLSearchParams): ReplaysListTab {
	const value = search.get('tab');
	if (value === 'member' || value === 'mine') {
		return value;
	}

	return 'community';
}

export const HISTORY_MATCHUP_TYPES: Record<HistoryMatchup, readonly number[]> = {
	'1v1': [1],
	'2v2': [2, 5],
	'3v3': [3, 6],
	'4v4': [4, 7]
};

export type CommunityPlayer = {
	playerId: number | null;
	steamId: string | null;
	race: number | null;
	likeCount?: number;
	/** Replay faction id (member uploads), e.g. allies_commonwealth. */
	faction?: string;
	/** Doctrine label from the .rec (member uploads). */
	doctrineName?: string;
	profile: {
		profile_id: number;
		alias: string;
	};
};

export type MatchResultPlayer = {
	profile_id: number;
	alias?: string;
	steamId?: string;
	name?: string;
	teamid?: number;
	race_id?: number;
	wins?: number;
	losses?: number;
	streak?: number;
	outcome?: number;
	oldrating?: number;
	newrating?: number;
	country?: string;
};

export type MatchResult = {
	description?: string;
	matchtype_id?: number;
	startgametime?: number;
	completiontime?: number;
	players?: MatchResultPlayer[];
} | null;

export type CommunityMatch = {
	id: string;
	map: string;
	title: string;
	result: MatchResult;
	createdAt: string;
	isRanked: boolean;
	hasReplay: boolean;
	likeCount: number;
	downloadCount: number;
	commentCount: number;
	players: CommunityPlayer[];
	kind?: 'match' | 'member';
	durationSeconds?: number | null;
	description?: string;
	visibility?: 'private' | 'member' | 'deleted';
};

export type CommunityMatchList = {
	page: number;
	perPage: number;
	totalItems: number;
	totalPages: number;
	items: CommunityMatch[];
};

export type CommunityMatchSubmittedBy = {
	alias: string;
	profileId: number;
	steamId?: string | null;
};

export type CommunityMatchDetail = {
	id: string;
	map: string;
	title: string;
	isRanked: boolean;
	createdAt: string;
	durationSeconds: number | null;
	likeCount: number;
	downloadCount: number;
	replay: string;
	hasReplay?: boolean;
	needsResult?: boolean;
	sessionId?: number;
	hidden?: boolean;
	hiddenByKeyword?: boolean;
	submittedBy?: CommunityMatchSubmittedBy | null;
	/** Staff-only: lobby updatedAt from PocketBase. */
	updatedAt?: string;
	/** Staff-only: uploader display name / email / id. */
	owner?: string | null;
	players: CommunityPlayer[];
	/** Slim players with leaderboard stats (rank/level/ELO) for Overview. */
	livePlayers?: import('@company-of-heroes/ui/live-lobby').LiveLobbyPlayer[] | null;
	result: MatchResult;
	kind?: 'match' | 'member';
	description?: string;
	filename?: string;
	mapFilename?: string;
	uploadedBy?: { id: string; alias: string } | null;
	visibility?: 'private' | 'member' | 'deleted';
	roster?: unknown[];
	memberReplayId?: string | null;
	canPublish?: boolean;
};

const SORT_FIELDS = new Set<HistorySortField>([
	'createdAt',
	'likeCount',
	'downloadCount',
	'commentCount'
]);
const MATCHUPS = new Set<HistoryMatchup>(['1v1', '2v2', '3v3', '4v4']);
const OPERATORS = new Set<FilterOperator>(['gt', 'gte', 'lt', 'lte']);

export function matchtypesForMatchups(matchups: string[]): number[] {
	const ids = new Set<number>();
	for (const matchup of matchups) {
		const types = HISTORY_MATCHUP_TYPES[matchup as HistoryMatchup];
		if (!types) continue;
		for (const id of types) ids.add(id);
	}
	return [...ids];
}

/** CoH slots are team-interleaved; UI position N maps to both teams. Stored slots are 1-based. */
export function slotsForPositions(positions: string[]): number[] {
	const slots = new Set<number>();
	for (const value of positions) {
		const position = Number(value);
		if (!Number.isInteger(position) || position < 1 || position > 4) continue;
		slots.add((position - 1) * 2 + 1);
		slots.add((position - 1) * 2 + 2);
	}
	return [...slots];
}

function parseOperator(raw: string | null): FilterOperator | null {
	if (raw && OPERATORS.has(raw as FilterOperator)) return raw as FilterOperator;
	return null;
}

function parseCompare(search: URLSearchParams, opKey: string, valueKey: string): CompareFilter | null {
	const op = parseOperator(search.get(opKey));
	const value = Number(search.get(valueKey) || '');
	if (!op || !Number.isFinite(value) || value < 0) return null;
	return { op, value };
}

export function parseReplaysQuery(search: URLSearchParams): ReplaysQuery {
	const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
	const matchups = splitCsv(search.get('modes') || search.get('mode')).filter((value) =>
		MATCHUPS.has(value as HistoryMatchup)
	) as HistoryMatchup[];
	const sortRaw = search.get('sort');
	const sort = SORT_FIELDS.has(sortRaw as HistorySortField)
		? (sortRaw as HistorySortField)
		: 'createdAt';
	const sortDir = search.get('sortDir') === 'asc' ? 'asc' : 'desc';
	return {
		page,
		ranked: search.get('ranked') === '1' || search.get('ranked') === 'true',
		pro: search.get('pro') === '1' || search.get('pro') === 'true',
		matchups,
		playerIds: splitCsv(search.get('players')),
		maps: splitCsv(search.get('maps')),
		races: splitCsv(search.get('races')),
		positions: splitCsv(search.get('positions')),
		elo: parseCompare(search, 'eloOp', 'elo'),
		duration: parseCompare(search, 'durationOp', 'duration'),
		sort,
		sortDir
	};
}

export function replaysSearchParams(query: ReplaysQuery): URLSearchParams {
	const params = new URLSearchParams();
	if (query.page > 1) params.set('page', String(query.page));
	if (query.ranked) params.set('ranked', '1');
	if (query.pro) params.set('pro', '1');
	if (query.matchups.length > 0) params.set('modes', query.matchups.join(','));
	if (query.playerIds.length > 0) params.set('players', query.playerIds.join(','));
	if (query.maps.length > 0) params.set('maps', query.maps.join(','));
	if (query.races.length > 0) params.set('races', query.races.join(','));
	if (query.positions.length > 0) params.set('positions', query.positions.join(','));
	if (query.elo) {
		params.set('eloOp', query.elo.op);
		params.set('elo', String(query.elo.value));
	}
	if (query.duration) {
		params.set('durationOp', query.duration.op);
		params.set('duration', String(query.duration.value));
	}
	if (query.sort !== 'createdAt') params.set('sort', query.sort);
	if (query.sortDir === 'asc') params.set('sortDir', 'asc');
	return params;
}

export function replaysHref(query: ReplaysQuery, tab: ReplaysListTab = 'community'): string {
	const params = replaysSearchParams(query);
	if (tab !== 'community') {
		params.set('tab', tab);
	}
	const search = params.toString();
	return search ? `/replays?${search}` : '/replays';
}

export function recentMemberQuery(): ReplaysQuery {
	return recentCommunityQuery();
}

const REPLAYS_LIST_HREF_KEY = 'coh1stats.replaysListHref';

function isReplaysListHref(href: string): boolean {
	const path = unlocalizedPath(href.split('?')[0] ?? '');
	return path === '/replays';
}

export function rememberReplaysListHref(href: string) {
	if (typeof sessionStorage === 'undefined' || !isReplaysListHref(href)) {
		return;
	}

	const [path, ...rest] = href.split('?');
	const stored = `${unlocalizedPath(path ?? '/replays')}${rest.length > 0 ? `?${rest.join('?')}` : ''}`;
	try {
		sessionStorage.setItem(REPLAYS_LIST_HREF_KEY, stored);
	} catch {
		// Private mode or quota.
	}
}

export function rememberedReplaysListHref(): string {
	if (typeof sessionStorage === 'undefined') return '/replays';
	try {
		const href = sessionStorage.getItem(REPLAYS_LIST_HREF_KEY);
		if (href && isReplaysListHref(href)) return href;
	} catch {
		// Private mode.
	}
	return '/replays';
}

function splitCsv(value: string | null): string[] {
	if (!value) return [];
	return value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

export function recentCommunityQuery(): ReplaysQuery {
	return {
		page: 1,
		ranked: false,
		pro: false,
		matchups: [],
		playerIds: [],
		maps: [],
		races: [],
		positions: [],
		elo: null,
		duration: null,
		sort: 'createdAt',
		sortDir: 'desc'
	};
}

export function buildMatchHistoryUrl(query: ReplaysQuery, perPage = REPLAYS_PER_PAGE): string {
	const params = new URLSearchParams({
		scope: 'community',
		page: String(query.page),
		perPage: String(perPage)
	});
	if (query.ranked) params.set('ranked', 'true');
	if (query.pro) params.set('pro', 'true');
	const matchtypes = matchtypesForMatchups(query.matchups);
	if (matchtypes.length > 0) params.set('matchtypes', matchtypes.join(','));
	if (query.playerIds.length > 0) params.set('playerIds', query.playerIds.join(','));
	if (query.maps.length > 0) params.set('maps', query.maps.join(','));
	if (query.races.length > 0) params.set('races', query.races.join(','));
	const slots = slotsForPositions(query.positions);
	if (slots.length > 0) params.set('slots', slots.join(','));
	if (query.elo) {
		params.set('eloOp', query.elo.op);
		params.set('elo', String(query.elo.value));
	}
	if (query.duration) {
		params.set('durationOp', query.duration.op);
		params.set('duration', String(query.duration.value * 60));
	}
	if (query.sort !== 'createdAt') {
		params.set('sort', query.sort);
		params.set('sortDir', query.sortDir);
	} else if (query.sortDir === 'asc') {
		params.set('sort', 'createdAt');
		params.set('sortDir', 'asc');
	}
	return `${API_URL}/api/match-history?${params.toString()}`;
}

export function matchFileUrl(match: Pick<CommunityMatchDetail, 'id' | 'replay'>): string | null {
	if (!match.replay) return null;
	return `${API_URL}/api/files/lobbies/${match.id}/${encodeURIComponent(match.replay)}`;
}

export function isAlliesRace(race: number | null | undefined): boolean {
	return race === 0 || race === 2;
}

export function isAxisRace(race: number | null | undefined): boolean {
	return race === 1 || race === 3;
}

export function teamPlayers(match: CommunityMatch | CommunityMatchDetail, team: 'allies' | 'axis') {
	return match.players.filter((player) =>
		team === 'allies' ? isAlliesRace(player.race) : isAxisRace(player.race)
	);
}

export function teamOutcome(
	match: CommunityMatch | CommunityMatchDetail,
	team: 'allies' | 'axis'
): 'win' | 'loss' | null {
	const members = teamPlayers(match, team);
	const resultPlayers = match.result?.players ?? [];
	for (const member of members) {
		const profileId = member.profile.profile_id;
		const result = resultPlayers.find((entry) => entry.profile_id === profileId);
		if (result?.outcome === 1) return 'win';
		if (result?.outcome === 0) return 'loss';
	}
	return null;
}

export function matchDurationSeconds(match: CommunityMatch | CommunityMatchDetail): number | null {
	if ('durationSeconds' in match && match.durationSeconds != null) {
		return match.durationSeconds;
	}
	const start = Number(match.result?.startgametime);
	const end = Number(match.result?.completiontime);
	if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
		return end - start;
	}
	return null;
}

export function formatDurationSeconds(seconds: number | null): string {
	if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
	const total = Math.round(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const rest = total % 60;
	if (hours > 0) return `${hours}h ${minutes}m ${rest}s`;
	return `${minutes}m ${rest}s`;
}

export function formatMatchDate(value: string | undefined, locale?: string): string {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '—';
	return date.toLocaleDateString(locale, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function formatSubmittedAt(value: string | undefined, locale?: string): string {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '—';
	const day = String(date.getDate()).padStart(2, '0');
	const month = date.toLocaleDateString(locale, { month: 'short' });
	const year = date.getFullYear();
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

function playerMatchElo(player: MatchResultPlayer): number | null {
	const previous = Number(player.oldrating);
	if (Number.isFinite(previous) && previous >= 1) return previous;
	const next = Number(player.newrating);
	if (Number.isFinite(next) && next >= 1) return next;
	return null;
}

export function getMatchAverageElo(match: CommunityMatch | CommunityMatchDetail): number | null {
	const players = match.result?.players;
	if (!players?.length) return null;
	const ratings: number[] = [];
	for (const player of players) {
		const rating = playerMatchElo(player);
		if (rating != null) ratings.push(rating);
	}
	if (ratings.length < 2) return null;
	if (ratings.length < players.length / 2) return null;
	return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

export function isProGameplayMatch(match: CommunityMatch | CommunityMatchDetail): boolean {
	if (!match.isRanked) return false;
	const matchType = Number(match.result?.matchtype_id);
	const rankedTypes = new Set([1, 2, 3, 4, 5, 6, 7]);
	const playerCount = match.result?.players?.length || match.players.length;
	const isStandard =
		(Number.isInteger(matchType) && rankedTypes.has(matchType)) ||
		playerCount === 2 ||
		playerCount === 4 ||
		playerCount === 6 ||
		playerCount === 8;
	if (!isStandard) return false;
	const average = getMatchAverageElo(match);
	const is1v1 = matchType === 1 || (!rankedTypes.has(matchType) && playerCount === 2);
	const threshold = is1v1 ? 1800 : 1850;
	return average != null && average >= threshold;
}

export function findResultPlayer(
	match: CommunityMatch | CommunityMatchDetail,
	player: CommunityPlayer
): MatchResultPlayer | undefined {
	const profileId = player.profile.profile_id;
	return match.result?.players?.find((entry) => entry.profile_id === profileId);
}

export function playerHref(player: CommunityPlayer): string | null {
	if (player.playerId === -1) return null;
	if (player.steamId) return `/players/${player.steamId}`;
	if (player.profile.profile_id) return `/players/${player.profile.profile_id}`;
	return null;
}

export type ParsedReplayPlayer = {
	id?: number;
	name: string;
	faction: string;
	doctrine?: number;
	doctrineName?: string;
	steamId?: string | null;
};

export type ParsedReplayMessage = {
	playerID: number;
	sender: string;
	recipient: number;
	timestamp: string;
	content: string;
};

export type ParsedReplayCommand = {
	type?: string;
	name?: string;
	description?: string;
};

export type ParsedReplayAction = {
	playerID: number;
	tick: number;
	timestamp: string;
	commandID?: number;
	objectID?: number;
	command?: ParsedReplayCommand | null;
};

export type ParsedReplay = {
	players: ParsedReplayPlayer[];
	duration: number;
	messages: ParsedReplayMessage[];
	actions: ParsedReplayAction[];
	/** Precomputed in the parse worker so overview CPM works without transferring actions. */
	cpmByPlayerId?: Record<string, string>;
	matchType: string;
	mapFileName: string;
	mapName: string;
	replayName: string;
	gameDate?: string;
	vpGame?: boolean;
	vpCount?: number;
	playerCount: number;
	randomStart?: boolean;
	highResources?: boolean;
};

export function raceFromReplayFaction(faction: string): number {
	const value = faction.toLowerCase();
	if (value.includes('commonwealth')) return 2;
	if (value.includes('panzer')) return 3;
	if (value.startsWith('axis')) return 1;
	return 0;
}

const ALLIED_DOCTRINE_BANNERS: Record<number, string> = {
	2: 'ct_branchbanner_top_allied_airborne.png',
	9: 'ct_branchbanner_top_allied_armor.png',
	17: 'ct_branchbanner_top_allied_infantry.png',
	316: 'ct_branchbanner_top_cmnw_infantry.png',
	323: 'ct_branchbanner_top_cmnw_airborne.png',
	330: 'ct_branchbanner_top_cmnw_armor.png'
};

const AXIS_DOCTRINE_BANNERS: Record<number, string> = {
	186: 'ct_branchbanner_top_axis_blitz.png',
	194: 'ct_branchbanner_top_axis_defense.png',
	265: 'ct_branchbanner_top_axis_terror.png',
	295: 'ct_branchbanner_top_pnze_00.png',
	302: 'ct_branchbanner_top_pnze_01.png',
	309: 'ct_branchbanner_top_pnze_02.png'
};

export function doctrineBannerUrl(player: ParsedReplayPlayer): string | null {
	const doctrine = player.doctrine;
	if (doctrine == null) return null;
	const file = player.faction.startsWith('allies')
		? ALLIED_DOCTRINE_BANNERS[doctrine]
		: AXIS_DOCTRINE_BANNERS[doctrine];
	return file ? `/doctrines/${file}` : null;
}

/** UNIT_COMMAND object IDs filtered by Replay Manager / C2A as non-input spam. */
const CPM_EXCLUDED_UNIT_COMMAND_IDS: ReadonlySet<number> = new Set([
	0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xa8
]);

const isAiTakeoverAction = (action: ParsedReplayAction): boolean =>
	action.command?.type === 'AI_TAKEOVER';

const isCpmExcludedAction = (action: ParsedReplayAction): boolean => {
	if (isAiTakeoverAction(action)) return true;
	return (
		(action.commandID ?? -1) === 0x37 &&
		CPM_EXCLUDED_UNIT_COMMAND_IDS.has(action.objectID ?? -1)
	);
};

export function countedActions(replay: ParsedReplay, playerId: number | undefined): ParsedReplayAction[] {
	if (playerId == null) return [];
	const actions = replay.actions.filter((action) => action.playerID === playerId);
	const takeover = actions.findIndex(isAiTakeoverAction);
	const window = takeover >= 0 ? actions.slice(0, takeover + 1) : actions;
	return window.filter((action) => !isCpmExcludedAction(action));
}

/**
 * CPM aligned with Replay Manager / C2A: unique (tick, commandID, objectID)
 * among eligible actions, divided by minutes until AI takeover (or match end).
 */
export function playerCpm(replay: ParsedReplay, playerId: number | undefined): string {
	if (playerId == null) {
		return '0';
	}

	const precomputed = replay.cpmByPlayerId?.[String(playerId)];
	if (precomputed != null) {
		return precomputed;
	}

	if (!(replay.duration > 0)) {
		return '0';
	}

	const playerActions = replay.actions.filter((action) => action.playerID === playerId);
	const takeover = playerActions.find(isAiTakeoverAction);
	const window = takeover
		? playerActions.slice(0, playerActions.indexOf(takeover))
		: playerActions;

	const keys = new Set<string>();
	for (const action of window) {
		if (isCpmExcludedAction(action)) continue;
		keys.add(`${action.tick}|${action.commandID ?? 0}|${action.objectID ?? 0}`);
	}
	if (keys.size === 0) return '0';

	const minutes = takeover
		? Math.max(takeover.tick / 8 / 60, 1 / 60)
		: Math.max(replay.duration / 60, 1 / 60);
	return String(Math.round(keys.size / minutes));
}
