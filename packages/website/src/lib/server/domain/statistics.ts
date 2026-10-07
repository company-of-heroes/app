import { getDoctrineName } from '@fknoobs/replay-parser';
import { ACTION_INFO } from '@company-of-heroes/ui/replay/action-info';
import {
	STATISTICS_MODES,
	type CommunityStatistics,
	type ReplaySummary,
	type ReplaySummaryPlayer,
	type StatisticsBlueprint,
	type StatisticsByMode,
	type StatisticsDoctrine,
	type StatisticsMode
} from '@company-of-heroes/ui/statistics/types';
import { BUILDERS } from './replay-summary';

/** Community match statistics: maps, factions, matchups and replay picks per mode and date range. */

/**
 * Match types per mode tab; the arranged-team (AT) ladders count with their size. The
 * `statistics_matches` view (migration 1791000024) selects the same match types.
 */
const MODE_OF_MATCHTYPE: Record<number, StatisticsMode> = {
	0: 'basic',
	1: '1v1',
	2: '2v2',
	5: '2v2',
	3: '3v3',
	6: '3v3',
	4: '4v4',
	7: '4v4',
	14: 'skirmish'
};

const UNIT_LIMIT = 8;
const UPGRADE_LIMIT = 6;
const OPENING_LIMIT = 3;

/** One `lobby_player_index` row with its lobby's start, length and title. */
export type StatisticsRow = {
	id: string;
	lobby: string;
	session_id: number;
	map: string;
	outcome: number | null;
	race_id: number | null;
	matchtype_id: number | null;
	profile_id: number;
	alias: string;
	createdAt: string;
	durationSeconds: number | null;
	lobbyTitle: string;
};

/**
 * A `statistics_uploads` row: an uploaded replay (member or personal library) with just what
 * the mode and duplicate check need. Its full summary is read separately (see `tallyUploads`).
 */
export type UploadRow = {
	id: string;
	gameDate: string;
	createdAt: string;
	mapFilename: string;
	durationInSeconds: number | null;
	isRanked: boolean;
	/** A computer player took part. */
	ai: boolean;
	/** Names of the human players. */
	names: string[];
	/** Race of each human player in the summary (empty when the replay did not parse). */
	races: number[];
};

/** Replay picks of one day, mode and map, summed; merging days gives any date range. */
export type ReplayTally = {
	matches: number;
	/** Race → player-games with a summary. */
	players: Record<string, number>;
	/** `race:doctrine` → picks, and wins among picks with a known result. */
	doctrines: Record<string, { picks: number; decided: number; wins: number }>;
	/** `race:blueprint` → orders and player-games that ordered it. */
	units: Record<string, { count: number; players: number }>;
	upgrades: Record<string, { count: number; players: number }>;
	openings: Record<string, { count: number; players: number }>;
};

/** `${day}|${mode}|${map}` → that day's replay picks on that map. */
export type DayReplays = Record<string, ReplayTally>;

/** Everything the statistics are computed from, cached between requests. */
export type StatisticsData = { matches: StatisticsMatch[]; replays: DayReplays };

/** One finished match, as cached between requests. */
export type StatisticsMatch = {
	lobby: string;
	/** An uploaded replay: no result, so it counts for picks and maps but not for win rates. */
	upload?: boolean;
	/** Start in ms (for matching uploads to games already counted). */
	time: number;
	/** YYYY-MM-DD (UTC). */
	day: string;
	/** UTC hour the match started. */
	hour: number;
	mode: StatisticsMode;
	map: string;
	durationSeconds: number | null;
	alliesWon: boolean | null;
	players: { race: number | null; outcome: number | null; profileId: number; alias: string }[];
};

/** Inclusive UTC days; `null` = open end. */
export type DayRange = { from: string | null; to: string | null };

const isAllies = (raceId: number) => raceId === 0 || raceId === 2;
const isAxis = (raceId: number) => raceId === 1 || raceId === 3;
const isFaction = (raceId: number | null): raceId is number =>
	raceId !== null && raceId >= 0 && raceId <= 3;

/** A lobby titled Skirmish (detected from the replay) is one, whatever Relic reported. */
function modeOf(row: StatisticsRow): StatisticsMode | undefined {
	return row.lobbyTitle === 'Skirmish' ? 'skirmish' : MODE_OF_MATCHTYPE[row.matchtype_id ?? -1];
}

function parseTime(value: string): number {
	return Date.parse(value.includes('T') ? value : value.replace(' ', 'T'));
}

function emptyTally(): ReplayTally {
	return { matches: 0, players: {}, doctrines: {}, units: {}, upgrades: {}, openings: {} };
}

function addCount(
	target: Record<string, { count: number; players: number }>,
	key: string,
	count: number
) {
	const entry = (target[key] ??= { count: 0, players: 0 });
	entry.count += count;
	entry.players++;
}

/** Adds what one replay's human players picked and built to its day, mode and map. */
export function tallyReplay(
	replays: DayReplays,
	match: Pick<StatisticsMatch, 'day' | 'mode' | 'map' | 'alliesWon'>,
	players: ReplaySummaryPlayer[]
) {
	const { day, mode, map, alliesWon } = match;
	const tally = (replays[`${day}|${mode}|${map}`] ??= emptyTally());
	tally.matches++;
	for (const player of players) {
		if (!isFaction(player.race)) {
			continue;
		}

		const raceId = player.race;
		tally.players[raceId] = (tally.players[raceId] ?? 0) + 1;
		if (player.doctrine !== null) {
			const doctrine = (tally.doctrines[`${raceId}:${player.doctrine}`] ??= {
				picks: 0,
				decided: 0,
				wins: 0
			});
			doctrine.picks++;
			if (alliesWon !== null) {
				doctrine.decided++;
				doctrine.wins += alliesWon === isAllies(raceId) ? 1 : 0;
			}
		}

		// Builders are in every game; leaving them out shows what players actually fight with.
		for (const [id, count] of Object.entries(player.units)) {
			if (!BUILDERS.has(Number(id))) {
				addCount(tally.units, `${raceId}:${id}`, count);
			}
		}

		for (const [id, count] of Object.entries(player.upgrades)) {
			addCount(tally.upgrades, `${raceId}:${id}`, count);
		}

		if (player.opening !== null) {
			addCount(tally.openings, `${raceId}:${player.opening}`, 1);
		}
	}
}

/**
 * Index rows (+ replay summaries by lobby id) into one record per finished match, with the
 * replays' picks summed per day. A Relic session counts once: when two companion users
 * stored the same match, a lobby with a replay summary wins, then the lowest id.
 */
export function buildMatches(
	rows: StatisticsRow[],
	replays: Map<string, ReplaySummary>
): StatisticsData {
	const byLobby = new Map<string, StatisticsRow[]>();
	for (const row of rows) {
		const lobbyRows = byLobby.get(row.lobby);
		if (lobbyRows) {
			lobbyRows.push(row);
		} else {
			byLobby.set(row.lobby, [row]);
		}
	}

	const hasReplay = (lobby: string) => (replays.get(lobby)?.players.length ?? 0) > 0;
	const perSession = new Map<number, string>();
	for (const [lobby, lobbyRows] of [...byLobby].sort(([a], [b]) => a.localeCompare(b))) {
		const sessionId = lobbyRows[0].session_id;
		const kept = perSession.get(sessionId);
		if (!kept || (!hasReplay(kept) && hasReplay(lobby))) {
			perSession.set(sessionId, lobby);
		}
	}

	const matches: StatisticsMatch[] = [];
	const tallies: DayReplays = {};
	for (const lobby of perSession.values()) {
		const lobbyRows = byLobby.get(lobby) ?? [];
		const first = lobbyRows[0];
		const mode = first ? modeOf(first) : undefined;
		if (!first || !mode) {
			continue;
		}

		// Relic reports a match without a result as everyone on US Forces, lost. Skirmish rows
		// are the humans only, so all of them losing to the AI can be a real result.
		const noWinner = !lobbyRows.some((row) => row.outcome === 1);
		if (noWinner && (mode !== 'skirmish' || lobbyRows.every((row) => row.race_id === 0))) {
			continue;
		}

		const allies = lobbyRows.find((row) => row.race_id !== null && isAllies(row.race_id));
		const axis = lobbyRows.find((row) => row.race_id !== null && isAxis(row.race_id));
		const time = parseTime(first.createdAt);
		const date = Number.isFinite(time) ? new Date(time) : null;
		const match: StatisticsMatch = {
			lobby,
			time: Number.isFinite(time) ? time : 0,
			day: date ? date.toISOString().slice(0, 10) : '',
			hour: date ? date.getUTCHours() : 0,
			mode,
			map: first.map,
			durationSeconds:
				first.durationSeconds && first.durationSeconds > 0 ? first.durationSeconds : null,
			alliesWon: allies ? allies.outcome === 1 : axis ? axis.outcome === 0 : null,
			players: lobbyRows.map((row) => ({
				race: row.race_id,
				outcome: row.outcome,
				profileId: row.profile_id,
				alias: row.alias
			}))
		};
		matches.push(match);
		const replay = replays.get(lobby);
		if (replay && hasReplay(lobby)) {
			tallyReplay(tallies, match, replay.players);
		}
	}

	return { matches, replays: tallies };
}

/** Two copies of one game: same map, started within this window (replay clocks can be a timezone off). */
const SAME_GAME_MS = 14 * 3_600_000;
const HUMANS_PER_RANKED_MODE: Record<number, StatisticsMode> = {
	2: '1v1',
	4: '2v2',
	6: '3v3',
	8: '4v4'
};

/** `DATA:scenarios\mp\classic\2p_semois\2p_semois` → `2p_semois` (the lobby `map`). */
function mapOfFile(file: string): string {
	return (file.split(/[\\/]/).pop() ?? '').trim().toLowerCase();
}

function uploadMode(upload: UploadRow): StatisticsMode {
	if (upload.ai) {
		return 'skirmish';
	}

	return upload.isRanked ? (HUMANS_PER_RANKED_MODE[upload.races.length] ?? 'basic') : 'basic';
}

/** Where a counted upload goes: its replay summary is added to this day, mode and map. */
export type KeptUploads = Map<string, { day: string; mode: StatisticsMode; map: string }>;

/**
 * Uploaded replays as matches, minus copies of a game that is already counted: a lobby (or
 * an earlier upload) on the same map, started within {@link SAME_GAME_MS}, with at least
 * half of the upload's player names. Uploads that a lobby links as its member replay, and
 * replays that did not parse, are left out too.
 */
function uploadMatches(
	uploads: UploadRow[],
	lobbies: StatisticsMatch[],
	linked: Set<string>
): { matches: StatisticsMatch[]; kept: KeptUploads } {
	const seen = new Map<string, { time: number; names: Set<string> }[]>();
	const remember = (map: string, time: number, names: Set<string>) => {
		const list = seen.get(map);
		if (list) {
			list.push({ time, names });
		} else {
			seen.set(map, [{ time, names }]);
		}
	};

	for (const match of lobbies) {
		remember(
			match.map.toLowerCase(),
			match.time,
			new Set(match.players.map((player) => player.alias.toLowerCase()).filter(Boolean))
		);
	}

	const matches: StatisticsMatch[] = [];
	const kept: KeptUploads = new Map();
	for (const upload of [...uploads].sort((a, b) => a.id.localeCompare(b.id))) {
		const time = parseTime(upload.gameDate || upload.createdAt);
		if (linked.has(upload.id) || upload.races.length === 0 || !Number.isFinite(time)) {
			continue;
		}

		const map = mapOfFile(upload.mapFilename);
		const names = new Set(upload.names.map((name) => name.toLowerCase()).filter(Boolean));
		const needed = Math.max(1, Math.ceil(names.size / 2));
		const duplicate = (seen.get(map) ?? []).some(
			(game) =>
				Math.abs(game.time - time) <= SAME_GAME_MS &&
				[...names].filter((name) => game.names.has(name)).length >= needed
		);
		if (duplicate) {
			continue;
		}

		remember(map, time, names);
		const date = new Date(time);
		const day = date.toISOString().slice(0, 10);
		const mode = uploadMode(upload);
		kept.set(upload.id, { day, mode, map });
		matches.push({
			lobby: upload.id,
			upload: true,
			time,
			day,
			hour: date.getUTCHours(),
			mode,
			map,
			durationSeconds:
				upload.durationInSeconds && upload.durationInSeconds > 0
					? Math.round(upload.durationInSeconds)
					: null,
			alliesWon: null,
			players: upload.races.map((race) => ({ race, outcome: null, profileId: 0, alias: '' }))
		});
	}

	return { matches, kept };
}

/** Adds the replay summaries of counted uploads to their day, mode and map (no result: no wins). */
export function tallyUploads(
	replays: DayReplays,
	kept: KeptUploads,
	records: { id: string; replayStats: ReplaySummary }[]
) {
	for (const record of records) {
		const place = kept.get(record.id);
		if (place && Array.isArray(record.replayStats?.players)) {
			tallyReplay(replays, { ...place, alliesWon: null }, record.replayStats.players);
		}
	}
}

/**
 * Lobby matches plus the uploaded replays that are not one of them (oldest first). The
 * uploads' picks are added afterwards with `tallyUploads`, for the ids in `kept`.
 */
export function buildStatistics(
	rows: StatisticsRow[],
	replays: Map<string, ReplaySummary>,
	uploads: UploadRow[],
	linkedUploads: Set<string>
): StatisticsData & { kept: KeptUploads } {
	const lobbies = buildMatches(rows, replays);
	const uploaded = uploadMatches(uploads, lobbies.matches, linkedUploads);
	return {
		matches: [...lobbies.matches, ...uploaded.matches].sort((a, b) => a.day.localeCompare(b.day)),
		replays: lobbies.replays,
		kept: uploaded.kept
	};
}

type MapTally = {
	played: number;
	durationSum: number;
	durationCount: number;
	decided: number;
	alliesWins: number;
};

type BlueprintTally = Map<string, { raceId: number; id: number; count: number; players: number }>;

type Bucket = {
	matchCount: number;
	firstAt: string | null;
	lastAt: string | null;
	maps: Map<string, MapTally>;
	factions: Map<number, { picks: number; wins: number; losses: number }>;
	matchups: Map<
		string,
		{ alliesRaceId: number; axisRaceId: number; games: number; alliesWins: number }
	>;
	players: Map<number, { alias: string; games: number }>;
	hours: number[];
	longest: CommunityStatistics['facts']['longestMatch'];
	replayMatches: number;
	uploadMatches: number;
	replayPlayers: Map<number, number>;
	doctrines: Map<string, Omit<StatisticsDoctrine, 'name'>>;
	units: BlueprintTally;
	upgrades: BlueprintTally;
	openings: BlueprintTally;
};

function emptyBucket(): Bucket {
	return {
		matchCount: 0,
		firstAt: null,
		lastAt: null,
		maps: new Map(),
		factions: new Map(),
		matchups: new Map(),
		players: new Map(),
		hours: Array.from({ length: 24 }, () => 0),
		longest: null,
		replayMatches: 0,
		uploadMatches: 0,
		replayPlayers: new Map(),
		doctrines: new Map(),
		units: new Map(),
		upgrades: new Map(),
		openings: new Map()
	};
}

function mergeBlueprints(
	target: BlueprintTally,
	source: Record<string, { count: number; players: number }>
) {
	for (const [key, value] of Object.entries(source)) {
		const [raceId, id] = key.split(':').map(Number);
		const entry = target.get(key) ?? { raceId, id, count: 0, players: 0 };
		entry.count += value.count;
		entry.players += value.players;
		target.set(key, entry);
	}
}

/** Adds one day's replay picks to the bucket of its mode. */
function mergeTally(bucket: Bucket, tally: ReplayTally) {
	bucket.replayMatches += tally.matches;
	for (const [race, players] of Object.entries(tally.players)) {
		bucket.replayPlayers.set(Number(race), (bucket.replayPlayers.get(Number(race)) ?? 0) + players);
	}

	for (const [key, value] of Object.entries(tally.doctrines)) {
		const [raceId, doctrine] = key.split(':').map(Number);
		const entry = bucket.doctrines.get(key) ?? { raceId, doctrine, picks: 0, decided: 0, wins: 0 };
		entry.picks += value.picks;
		entry.decided += value.decided;
		entry.wins += value.wins;
		bucket.doctrines.set(key, entry);
	}

	mergeBlueprints(bucket.units, tally.units);
	mergeBlueprints(bucket.upgrades, tally.upgrades);
	mergeBlueprints(bucket.openings, tally.openings);
}

function addMap(bucket: Bucket, match: StatisticsMatch) {
	if (!match.map) {
		return;
	}

	const map = bucket.maps.get(match.map) ?? {
		played: 0,
		durationSum: 0,
		durationCount: 0,
		decided: 0,
		alliesWins: 0
	};
	map.played++;
	if (match.durationSeconds !== null) {
		map.durationSum += match.durationSeconds;
		map.durationCount++;
	}

	if (match.alliesWon !== null) {
		map.decided++;
		map.alliesWins += match.alliesWon ? 1 : 0;
	}

	bucket.maps.set(match.map, map);
}

function addMatch(bucket: Bucket, match: StatisticsMatch) {
	const { alliesWon } = match;
	bucket.matchCount++;
	bucket.uploadMatches += match.upload ? 1 : 0;
	if (!bucket.firstAt || match.day < bucket.firstAt) {
		bucket.firstAt = match.day;
	}

	if (!bucket.lastAt || match.day > bucket.lastAt) {
		bucket.lastAt = match.day;
	}

	bucket.hours[match.hour]++;
	const duration = match.durationSeconds;
	// Only lobbies: the fact links to the match page, and uploads may be private.
	if (
		!match.upload &&
		duration !== null &&
		(!bucket.longest || duration > bucket.longest.durationSeconds)
	) {
		bucket.longest = { lobbyId: match.lobby, map: match.map, durationSeconds: duration };
	}

	for (const player of match.players) {
		if (isFaction(player.race)) {
			const faction = bucket.factions.get(player.race) ?? { picks: 0, wins: 0, losses: 0 };
			faction.picks++;
			// Uploaded replays have no result: they count as a pick, not as a win or loss.
			if (player.outcome === 1) {
				faction.wins++;
			} else if (player.outcome === 0) {
				faction.losses++;
			}

			bucket.factions.set(player.race, faction);
		}

		if (player.profileId > 0) {
			const entry = bucket.players.get(player.profileId) ?? { alias: player.alias, games: 0 };
			entry.games++;
			entry.alias = player.alias || entry.alias;
			bucket.players.set(player.profileId, entry);
		}
	}

	if (alliesWon === null) {
		return;
	}

	const races = match.players.map((player) => player.race).filter(isFaction);
	const alliesRaces = new Set(races.filter(isAllies));
	const axisRaces = new Set(races.filter(isAxis));
	for (const alliesRaceId of alliesRaces) {
		for (const axisRaceId of axisRaces) {
			const key = `${alliesRaceId}:${axisRaceId}`;
			const matchup = bucket.matchups.get(key) ?? {
				alliesRaceId,
				axisRaceId,
				games: 0,
				alliesWins: 0
			};
			matchup.games++;
			matchup.alliesWins += alliesWon ? 1 : 0;
			bucket.matchups.set(key, matchup);
		}
	}
}

/**
 * The top `limit` blueprints of every faction, named from the game's own strings. Ids without a
 * name (e.g. summaries from an older parser, until the replay-stats job redoes them) are left out.
 */
function topPerFaction(tally: BlueprintTally, list: string, limit: number): StatisticsBlueprint[] {
	const byRace = new Map<number, StatisticsBlueprint[]>();
	for (const entry of tally.values()) {
		const name = ACTION_INFO[list]?.[entry.id]?.name;
		if (!name) {
			continue;
		}

		byRace.set(entry.raceId, [...(byRace.get(entry.raceId) ?? []), { ...entry, name }]);
	}

	return [...byRace.entries()]
		.sort(([a], [b]) => a - b)
		.flatMap(([, entries]) => entries.sort((a, b) => b.count - a.count).slice(0, limit));
}

function finish(bucket: Bucket): CommunityStatistics {
	const busiest = bucket.hours.reduce(
		(best, count, hour) => (count > bucket.hours[best] ? hour : best),
		0
	);
	let mostActive: CommunityStatistics['facts']['mostActive'] = null;
	for (const [profileId, player] of bucket.players) {
		if (!mostActive || player.games > mostActive.games) {
			mostActive = { profileId, alias: player.alias, games: player.games };
		}
	}

	const doctrines = [...bucket.doctrines.values()]
		.map((doctrine) => ({
			...doctrine,
			name: getDoctrineName(doctrine.doctrine) ?? `#${doctrine.doctrine}`
		}))
		.sort((a, b) => a.raceId - b.raceId || b.picks - a.picks);
	const units = topPerFaction(bucket.units, 'sbps', UNIT_LIMIT);

	return {
		matchCount: bucket.matchCount,
		firstAt: bucket.firstAt,
		lastAt: bucket.lastAt,
		maps: [...bucket.maps]
			.map(([map, tally]) => ({
				map,
				played: tally.played,
				avgDurationSeconds:
					tally.durationCount > 0 ? Math.round(tally.durationSum / tally.durationCount) : null,
				decided: tally.decided,
				alliesWins: tally.alliesWins
			}))
			.sort((a, b) => b.played - a.played || a.map.localeCompare(b.map)),
		factions: [...bucket.factions]
			.map(([raceId, tally]) => ({ raceId, ...tally }))
			.sort((a, b) => a.raceId - b.raceId),
		matchups: [...bucket.matchups.values()].sort(
			(a, b) => a.alliesRaceId - b.alliesRaceId || a.axisRaceId - b.axisRaceId
		),
		facts: {
			longestMatch: bucket.longest,
			mostActive,
			busiestHour: bucket.matchCount > 0 ? busiest : null,
			topDoctrine: doctrines.reduce<StatisticsDoctrine | null>(
				(best, doctrine) => (!best || doctrine.picks > best.picks ? doctrine : best),
				null
			),
			topUnit: units.reduce<StatisticsBlueprint | null>(
				(best, unit) => (!best || unit.count > best.count ? unit : best),
				null
			)
		},
		replayMatches: bucket.replayMatches,
		uploadMatches: bucket.uploadMatches,
		replayPlayers: [...bucket.replayPlayers]
			.map(([raceId, players]) => ({ raceId, players }))
			.sort((a, b) => a.raceId - b.raceId),
		doctrines,
		units,
		upgrades: topPerFaction(bucket.upgrades, 'upgrade', UPGRADE_LIMIT),
		openings: topPerFaction(bucket.openings, 'sbps', OPENING_LIMIT)
	};
}

/**
 * Every mode's statistics over the matches played in `range`. With a `map`, everything but the
 * map list (which stays complete, to pick another map from) covers that map only, in the modes
 * where it was played in `range`; the other modes stay unfiltered.
 */
export function summarizeStatistics(
	data: StatisticsData,
	range: DayRange,
	map: string | null = null
): StatisticsByMode {
	const inRange = (day: string) =>
		!((range.from && day < range.from) || (range.to && day > range.to));
	const buckets = Object.fromEntries(
		STATISTICS_MODES.map((mode) => [mode, emptyBucket()])
	) as Record<StatisticsMode, Bucket>;
	const filtered = new Set(
		data.matches
			.filter((match) => map && match.map === map && inRange(match.day))
			.map((match) => match.mode)
	);
	const counts = (mode: StatisticsMode, matchMap: string) =>
		!filtered.has(mode) || matchMap === map;
	for (const match of data.matches) {
		if (!inRange(match.day)) {
			continue;
		}

		addMap(buckets[match.mode], match);
		if (counts(match.mode, match.map)) {
			addMatch(buckets[match.mode], match);
		}
	}

	for (const [key, tally] of Object.entries(data.replays)) {
		const [day, mode, ...rest] = key.split('|') as [string, StatisticsMode, ...string[]];
		if (inRange(day) && buckets[mode] && counts(mode, rest.join('|'))) {
			mergeTally(buckets[mode], tally);
		}
	}

	return Object.fromEntries(
		STATISTICS_MODES.map((mode) => [mode, finish(buckets[mode])])
	) as StatisticsByMode;
}
