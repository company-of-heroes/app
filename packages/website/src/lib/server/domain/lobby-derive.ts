import es from '@company-of-heroes/i18n/locales/es.json';
import ko from '@company-of-heroes/i18n/locales/ko.json';
import { isRankedMatch } from '@company-of-heroes/ui/format/match-type';
import { leaderboardIdForMatchRace } from './relic-matches';
import { isValidSteamId, steamIdFromRelicName, type EloSlotUpdate } from './ratings';

/**
 * Everything the lobby pipeline stores next to what the app wrote: the slim
 * player list, per-player summaries, filter columns, one `lobby_player_index`
 * row per player, rating updates and smurf-watch candidates. Pure, so a lobby
 * can be re-processed at any time with the same outcome.
 */

/** The `lobbies` columns the derivation reads. */
export type StoredLobby = {
	id: string;
	user?: string;
	isRanked?: boolean;
	sessionId?: number;
	title?: string;
	map?: string;
	players?: unknown;
	result?: unknown;
	needsResult?: boolean;
	replay?: string;
	memberReplay?: string;
	lobbyPlayers?: unknown;
	avgElo?: number | null;
};

/** Player as the app stores it in `lobbies.players`. */
type AppPlayer = {
	playerId?: number;
	profile_id?: number;
	steamId?: string;
	steam_id?: string;
	race?: number;
	slot?: number;
	alias?: string;
	profile?: { profile_id?: number; alias?: string; leaderboardStats?: LadderStat[] };
	[key: string]: unknown;
};
type LadderStat = {
	leaderboard_id?: number;
	wins?: number;
	losses?: number;
	streak?: number;
	rank?: number;
	ranklevel?: number;
	rankLevel?: number;
};

/** Player in a Relic match result (`lobbies.result.players`). */
type ResultPlayer = {
	profile_id?: number;
	steamId?: string;
	name?: string;
	alias?: string;
	outcome?: number;
	race_id?: number;
	oldrating?: number;
	newrating?: number;
};
type MatchResult = {
	id?: number;
	matchtype_id?: number;
	description?: string;
	startgametime?: number;
	completiontime?: number;
	players?: unknown;
};

export type PlayerSummary = {
	profile_id: number;
	alias: string;
	playerId: number | null;
	steamId: string | null;
	race: number | null;
	stats?: {
		elo: number | null;
		wins: number;
		losses: number;
		streak: number;
		rank: number;
		rankLevel: number;
	};
};

export type IndexRow = {
	lobby: string;
	profile_id: number;
	steam_id: string;
	outcome: number | null;
	race_id: number | null;
	matchtype_id: number | null;
	elo: number | null;
	slot: number | null;
	alias: string;
	session_id: number;
	map: string;
	lobby_user: string;
	counts: boolean;
};

export type RatingUpdate = {
	steamId: string;
	profileId: number;
	alias: string;
	slots: EloSlotUpdate[];
};

export type HiddenRules = { sessions: Set<number>; keywords: string[] };

/** Written by the app but never read back; `matchHistory` alone was ~438 KB per lobby. */
const HEAVY_PLAYER_KEYS = ['matchHistory', 'storedElo'];

const LADDER_TITLE = /^\d VS\. \d$/;
/** Match types older app versions stored translated in `lobbies.title`, by translation. */
export const TRANSLATED_TITLES = new Map<string, string>(
	['Basic Match', 'Custom Game', 'Skirmish'].flatMap((key) =>
		[es, ko].map((locale) => [(locale as Record<string, string>)[key], key] as [string, string])
	)
);

/**
 * The stored title in English (the server compares it, e.g. "Skirmish"). Older servers
 * titled custom games by their size ("2 VS. 2"); with a Basic Match result that is wrong.
 */
function matchTitle(
	title: string | undefined,
	isRanked: boolean,
	result: MatchResult | null
): string | undefined {
	const english = title ? (TRANSLATED_TITLES.get(title) ?? title) : title;
	if (result && !isRanked && LADDER_TITLE.test(english ?? '')) {
		return 'Basic Match';
	}

	return english;
}

const finite = (value: unknown): number | null => {
	if (value === null || value === undefined || value === '') {
		return null;
	}

	const n = Number(value);
	return Number.isFinite(n) ? n : null;
};

function parseJson(raw: unknown): unknown {
	if (typeof raw !== 'string') {
		return raw;
	}

	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function parseResult(raw: unknown): MatchResult | null {
	const value = parseJson(raw);
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as MatchResult)
		: null;
}

function parsePlayers(raw: unknown): AppPlayer[] {
	const value = parseJson(raw);
	return Array.isArray(value) ? (value as AppPlayer[]) : [];
}

function resultPlayers(result: MatchResult | null): ResultPlayer[] {
	return Array.isArray(result?.players) ? (result.players as ResultPlayer[]) : [];
}

/** Rating the player had going into the match (new rating when the old one is missing). */
function matchElo(player: ResultPlayer): number | null {
	const before = finite(player.oldrating);
	if (before !== null && before >= 1) {
		return before;
	}

	const after = finite(player.newrating);
	return after !== null && after >= 1 ? after : null;
}

function resultSteamId(player: ResultPlayer): string {
	return player.steamId
		? String(player.steamId)
		: typeof player.name === 'string' && player.name.startsWith('/steam/')
			? player.name.slice(7)
			: '';
}

export function durationSeconds(result: MatchResult | null): number | null {
	const start = finite(result?.startgametime);
	const end = finite(result?.completiontime);
	return start === null || end === null || end <= start ? null : end - start;
}

/** Average pre-game rating; null unless at least two and half of the players have one. */
export function averageElo(result: MatchResult | null): number | null {
	const players = resultPlayers(result);
	const ratings = players.map(matchElo).filter((rating): rating is number => rating !== null);
	if (ratings.length < 2 || ratings.length < players.length / 2) {
		return null;
	}

	return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

export function slimPlayers(players: AppPlayer[]): { players: AppPlayer[]; changed: boolean } {
	let changed = false;
	const slim = players.map((player) => {
		if (
			!player ||
			typeof player !== 'object' ||
			!HEAVY_PLAYER_KEYS.some((key) => player[key] !== undefined)
		) {
			return player;
		}

		changed = true;
		const copy = { ...player };
		for (const key of HEAVY_PLAYER_KEYS) {
			delete copy[key];
		}
		return copy;
	});
	return { players: slim, changed };
}

/** Ladder the summary badges come from: the result's type, else guessed from the human count (ranked only). */
function summaryMatchType(
	players: AppPlayer[],
	isRanked: boolean,
	resultMatchType: number | null
): number {
	if (resultMatchType === 14) {
		return 14;
	}

	if (!isRanked) {
		return 0;
	}

	if (resultMatchType !== null && resultMatchType >= 1 && resultMatchType <= 4) {
		return resultMatchType;
	}

	const humans = players.filter((player) => finite(player?.playerId) !== -1).length;
	const byHumans: Record<number, number> = { 2: 1, 4: 2, 6: 3, 8: 4 };
	return byHumans[humans] ?? 0;
}

function summaryStats(
	player: AppPlayer,
	matchType: number,
	eloByProfile: Map<number, number>
): PlayerSummary['stats'] | null {
	const race = finite(player?.race);
	if (race === null) {
		return null;
	}

	const leaderboardId = leaderboardIdForMatchRace(matchType, race);
	const ladders = Array.isArray(player.profile?.leaderboardStats)
		? player.profile.leaderboardStats
		: [];
	const stat =
		leaderboardId === null
			? undefined
			: ladders.find((entry) => finite(entry.leaderboard_id) === leaderboardId);

	const playerId = finite(player.playerId);
	const profileId =
		finite(player.profile?.profile_id) ?? (playerId !== null && playerId > 0 ? playerId : null);
	const elo = profileId === null ? null : (eloByProfile.get(profileId) ?? null);
	const wins = stat ? (finite(stat.wins) ?? 0) : 0;
	const losses = stat ? (finite(stat.losses) ?? 0) : 0;
	const streak = stat ? (finite(stat.streak) ?? 0) : 0;
	// Basic ladders (0-3) are not ranked: no rank badges from them.
	const rankedLadder = (matchType >= 1 && matchType <= 4) || matchType === 14;
	const rank = rankedLadder && stat ? (finite(stat.rank) ?? 0) : 0;
	const rankLevel = rankedLadder && stat ? (finite(stat.ranklevel ?? stat.rankLevel) ?? 0) : 0;

	if (elo === null && wins === 0 && losses === 0 && rank === 0 && rankLevel === 0) {
		return null;
	}

	return { elo, wins, losses, streak, rank: Math.max(rank, 0), rankLevel: Math.max(rankLevel, 0) };
}

/** Per-player summary stored as `lobbies.lobbyPlayers` (players without a profile id are skipped). */
export function summarizePlayers(
	players: AppPlayer[],
	isRanked: boolean,
	result: MatchResult | null
): PlayerSummary[] {
	const matchType = summaryMatchType(players, isRanked, finite(result?.matchtype_id));
	const eloByProfile = new Map<number, number>();
	for (const player of resultPlayers(result)) {
		const profileId = finite(player?.profile_id);
		const elo = matchElo(player ?? {});
		if (profileId !== null && profileId > 0 && elo !== null) {
			eloByProfile.set(profileId, elo);
		}
	}

	const summaries: PlayerSummary[] = [];
	for (const player of players) {
		const playerId = player?.playerId;
		const profileId =
			player?.profile?.profile_id ?? (playerId != null && playerId > 0 ? playerId : null);
		if (profileId == null) {
			continue;
		}

		const summary: PlayerSummary = {
			profile_id: profileId,
			alias: player.profile?.alias ?? '',
			playerId: playerId ?? null,
			steamId: player.steamId ?? null,
			race: player.race ?? null
		};
		const stats = summaryStats(player, matchType, eloByProfile);
		if (stats) {
			summary.stats = stats;
		}

		summaries.push(summary);
	}
	return summaries;
}

const TITLE_SEPARATORS = /[-_/.():,;!?#@+='"[\]{}|\\~*&%<>`^]/g;

/** Lowercased, separators as spaces, padded, so a keyword only matches whole words. */
function wordText(value: string): string {
	return ` ${value.replace(TITLE_SEPARATORS, ' ')} `.toLowerCase();
}

/** True when the match title contains a hidden keyword as a whole word (or words). */
export function titleIsHidden(title: string | undefined, keywords: string[]): boolean {
	const text = wordText(title ?? '');
	return keywords.some((word) => word.trim() !== '' && text.includes(wordText(word)));
}

/** "Pro" = ranked with a high average: 1800+ for 1v1, 1850+ for team games. */
function isPro(
	isRanked: boolean,
	avgElo: number | null,
	matchtypeId: number | null,
	playerCount: number | null
): boolean {
	if (!isRanked || avgElo === null) {
		return false;
	}

	if (matchtypeId === 1) {
		return avgElo >= 1800;
	}

	if (matchtypeId !== null && matchtypeId >= 2 && matchtypeId <= 7) {
		return avgElo >= 1850;
	}

	if (playerCount === 2) {
		return avgElo >= 1800;
	}

	return (playerCount === 4 || playerCount === 6 || playerCount === 8) && avgElo >= 1850;
}

/** Relic player slot 0-7, shown as 1-8. */
function displaySlots(players: AppPlayer[]): Map<number, number> {
	const slots = new Map<number, number>();
	for (const player of players) {
		const slot = finite(player?.slot);
		if (slot === null || slot < 0 || slot > 7) {
			continue;
		}

		for (const id of [player.playerId, player.profile_id, player.profile?.profile_id]) {
			const profileId = finite(id);
			if (profileId !== null && profileId > 0) {
				slots.set(profileId, slot + 1);
			}
		}
	}
	return slots;
}

function indexRows(
	lobby: StoredLobby,
	summaries: PlayerSummary[],
	players: AppPlayer[],
	result: MatchResult | null
): IndexRow[] {
	const fromResult = new Map<number, ResultPlayer>();
	for (const player of resultPlayers(result)) {
		const profileId = finite(player?.profile_id);
		if (profileId !== null && profileId > 0) {
			fromResult.set(profileId, player);
		}
	}
	const profileIds = new Set<number>();
	for (const summary of summaries) {
		const profileId = finite(summary.profile_id);
		if (profileId !== null && profileId > 0) {
			profileIds.add(profileId);
		}
	}
	for (const profileId of fromResult.keys()) {
		profileIds.add(profileId);
	}

	const matchtypeId = finite(result?.matchtype_id);
	const slots = displaySlots(players);
	const counts = !lobby.needsResult && lobby.title !== 'Skirmish';

	return [...profileIds].map((profileId) => {
		const played = fromResult.get(profileId);
		const outcome = finite(played?.outcome);
		const summaryAlias = summaries
			.find((summary) => Number(summary.profile_id) === profileId)
			?.alias?.trim();
		return {
			lobby: lobby.id,
			profile_id: profileId,
			steam_id: played ? resultSteamId(played) : '',
			outcome: outcome === 0 || outcome === 1 ? outcome : null,
			race_id: played ? finite(played.race_id) : null,
			matchtype_id: played ? matchtypeId : null,
			elo: played ? matchElo(played) : null,
			slot: slots.get(profileId) ?? null,
			alias: summaryAlias || played?.alias?.trim() || '',
			session_id: finite(lobby.sessionId) ?? 0,
			map: lobby.map ? String(lobby.map) : '',
			lobby_user: lobby.user ? String(lobby.user) : '',
			counts
		};
	});
}

/** Stored ELO updates from a finished, non-Skirmish match (matchId/at pick the newest per slot). */
export function ratingUpdates(result: MatchResult | null, now: number): RatingUpdate[] {
	const matchtypeId = finite(result?.matchtype_id);
	if (
		!result ||
		matchtypeId === null ||
		!Number.isInteger(matchtypeId) ||
		matchtypeId < 0 ||
		matchtypeId > 7
	) {
		return [];
	}

	const matchId = finite(result.id);
	let at = finite(result.completiontime ?? result.startgametime ?? 0) ?? NaN;
	// Cap far-future timestamps so a client cannot lock a slot forever.
	if (at > now + 60) {
		at = now;
	}

	if (matchId === null || matchId <= 0 || !(at >= 0)) {
		return [];
	}

	const bySteam = new Map<string, RatingUpdate>();
	for (const player of resultPlayers(result)) {
		const steamId = player?.steamId || steamIdFromRelicName(player?.name);
		const raceId = finite(player?.race_id);
		const rating = finite(player?.newrating);
		const profileId = finite(player?.profile_id);
		if (
			!isValidSteamId(steamId) ||
			raceId === null ||
			!Number.isInteger(raceId) ||
			raceId < 0 ||
			raceId > 3 ||
			rating === null ||
			rating < 1
		) {
			continue;
		}

		if (profileId === null || !Number.isInteger(profileId) || profileId <= 0) {
			continue;
		}

		bySteam.set(steamId, {
			steamId,
			profileId,
			alias: typeof player.alias === 'string' ? player.alias.trim() : '',
			slots: [{ matchtypeId, raceId, rating, matchId, at }]
		});
	}
	return [...bySteam.values()];
}

export type LobbyDerivation = {
	/** Columns to write back to the lobby (only what the derivation owns). */
	columns: {
		players?: AppPlayer[];
		lobbyPlayers?: PlayerSummary[];
		playerProfileIdsCsv?: string;
		hasReplay: boolean;
		isRanked?: boolean;
		title?: string;
		durationSeconds?: number;
		avgElo?: number;
		matchtypeId: number;
		playerCount: number;
		isPro: boolean;
		isCommunity: boolean;
		isHidden: boolean;
	};
	indexRows: IndexRow[];
	ratings: RatingUpdate[];
	/** Every Steam id seen in the lobby (for "match played" reputation). */
	steamIds: string[];
	/** Players to put on the smurf watch list. */
	smurfCandidates: { steamId: string; profileId: number | null }[];
};

export function deriveLobby(
	stored: StoredLobby,
	hidden: HiddenRules,
	now = Math.floor(Date.now() / 1000)
): LobbyDerivation {
	const result = parseResult(stored.result);
	// Relic's match type decides once there is a result: a Basic Match is never ranked.
	const isRanked = isRankedMatch(stored.isRanked, result);
	const lobby = { ...stored, title: matchTitle(stored.title, isRanked, result) };
	const slim = slimPlayers(parsePlayers(lobby.players));
	const summaries = summarizePlayers(slim.players, isRanked, result);
	// Never clear stored summaries when the players did not parse.
	const effectiveSummaries =
		summaries.length > 0
			? summaries
			: parsePlayers(lobby.lobbyPlayers).map((player) => player as unknown as PlayerSummary);

	const duration = durationSeconds(result);
	const avgElo = averageElo(result) ?? finite(lobby.avgElo);
	const matchtypeId = finite(result?.matchtype_id);
	const playerCount = Array.isArray(result?.players) ? result.players.length : null;
	const hasReplay = !!lobby.replay;

	const columns: LobbyDerivation['columns'] = {
		hasReplay,
		matchtypeId: matchtypeId === null ? 0 : Math.trunc(matchtypeId),
		playerCount: playerCount ?? 0,
		isPro: isPro(isRanked, avgElo, matchtypeId, playerCount),
		isCommunity:
			!lobby.needsResult && lobby.title !== 'Skirmish' && hasReplay && !lobby.memberReplay,
		isHidden:
			hidden.sessions.has(Number(lobby.sessionId)) ||
			titleIsHidden(result?.description, hidden.keywords)
	};
	if (result && isRanked !== !!stored.isRanked) {
		columns.isRanked = isRanked;
	}

	if (lobby.title !== stored.title) {
		columns.title = lobby.title;
	}

	if (slim.changed) {
		columns.players = slim.players;
	}

	if (summaries.length > 0) {
		const ids = summaries.map((summary) => summary.profile_id);
		columns.lobbyPlayers = summaries;
		columns.playerProfileIdsCsv = `,${ids.join(',')},`;
	}

	if (duration !== null) {
		columns.durationSeconds = duration;
	}

	if (averageElo(result) !== null) {
		columns.avgElo = avgElo as number;
	}

	const rows = indexRows(lobby, effectiveSummaries, slim.players, result);
	const steamIds = new Set<string>();
	for (const id of [
		...rows.map((row) => row.steam_id),
		...effectiveSummaries.map((summary) => summary.steamId),
		...resultPlayers(result).map((player) => player?.steamId)
	]) {
		const steamId = steamIdFromRelicName(id ? String(id).trim() : '');
		if (steamId) {
			steamIds.add(steamId);
		}
	}

	const smurfCandidates = new Map<string, number | null>();
	const smurfSource =
		summaries.length > 0
			? summaries
			: effectiveSummaries.length > 0
				? effectiveSummaries
				: slim.players;
	for (const player of smurfSource as (PlayerSummary & AppPlayer)[]) {
		const steamId = player?.steamId || player?.steam_id;
		if (steamId && !smurfCandidates.has(String(steamId))) {
			smurfCandidates.set(String(steamId), finite(player.profile?.profile_id ?? player.profile_id));
		}
	}

	return {
		columns,
		indexRows: rows,
		ratings: lobby.title === 'Skirmish' ? [] : ratingUpdates(result, now),
		steamIds: [...steamIds],
		smurfCandidates: [...smurfCandidates].map(([steamId, profileId]) => ({ steamId, profileId }))
	};
}
