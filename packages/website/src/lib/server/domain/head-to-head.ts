/** The signed-in user's win/loss record against one other player. */

export type HeadToHeadMatchup = {
	raceId: number;
	theirRaceId: number;
	wins: number;
	losses: number;
};
export type HeadToHeadMode = { matchtypeId: number; wins: number; losses: number };
export type HeadToHead = {
	profileId: number;
	matchCount: number;
	wins: number;
	losses: number;
	lastSessionId: number | null;
	byMatchup: HeadToHeadMatchup[];
	byMode: HeadToHeadMode[];
};

/** One `lobby_player_index` row (of the user or of the other player). */
export type HeadToHeadRow = {
	id: string;
	lobby: string;
	session_id: number;
	profile_id: number;
	outcome: number | null;
	race_id: number | null;
	matchtype_id: number | null;
};

export const ROW_FIELDS = 'id,lobby,session_id,profile_id,outcome,race_id,matchtype_id';

type WinLoss = { wins: number; losses: number };

export function emptyHeadToHead(profileId: number): HeadToHead {
	return {
		profileId,
		matchCount: 0,
		wins: 0,
		losses: 0,
		lastSessionId: null,
		byMatchup: [],
		byMode: []
	};
}

/** Allies (0, 2) → 0, Axis (1, 3) → 1, anything else unknown. */
export function teamFromRace(race: number | null): 0 | 1 | null {
	if (race === 0 || race === 2) {
		return 0;
	}

	if (race === 1 || race === 3) {
		return 1;
	}

	return null;
}

const byGames = (a: WinLoss, b: WinLoss) => b.wins + b.losses - (a.wins + a.losses);
const isRace = (race: number | null): race is number => race !== null && race >= 0 && race <= 3;

/** Decided rows per session; the first row by id wins (a match can have one lobby per uploader). */
function perSession(rows: HeadToHeadRow[]): Map<number, HeadToHeadRow> {
	const sessions = new Map<number, HeadToHeadRow>();
	const decided = rows.filter(
		(row) => row.session_id > 0 && (row.outcome === 0 || row.outcome === 1)
	);
	for (const row of decided.sort((a, b) => a.id.localeCompare(b.id))) {
		if (!sessions.has(row.session_id)) {
			sessions.set(row.session_id, row);
		}
	}

	return sessions;
}

/** Opponents are on the other team; without both factions, a different result decides. */
function isOpponent(mine: HeadToHeadRow, theirs: HeadToHeadRow): boolean {
	const myTeam = teamFromRace(mine.race_id);
	const theirTeam = teamFromRace(theirs.race_id);
	if (myTeam !== null && theirTeam !== null) {
		return myTeam !== theirTeam;
	}

	return mine.outcome !== theirs.outcome;
}

/**
 * Games where the user and `profileId` met as opponents (teammates are left out), with
 * the totals, per matchup (my faction vs theirs) and per mode.
 */
export function summarizeHeadToHead(
	profileId: number,
	mine: HeadToHeadRow[],
	theirs: HeadToHeadRow[]
): HeadToHead {
	const theirSessions = perSession(theirs);
	const summary = emptyHeadToHead(profileId);
	const matchups = new Map<string, HeadToHeadMatchup>();
	const modes = new Map<number, HeadToHeadMode>();
	for (const [sessionId, me] of perSession(mine)) {
		const them = theirSessions.get(sessionId);
		if (!them || me.profile_id === them.profile_id || !isOpponent(me, them)) {
			continue;
		}

		const won = me.outcome === 1;
		const count = (entry: WinLoss) => {
			if (won) {
				entry.wins++;
			} else {
				entry.losses++;
			}
		};
		count(summary);
		summary.lastSessionId = Math.max(summary.lastSessionId ?? 0, sessionId);
		if (isRace(me.race_id) && isRace(them.race_id)) {
			const key = `${me.race_id}:${them.race_id}`;
			const entry = matchups.get(key) ?? {
				raceId: me.race_id,
				theirRaceId: them.race_id,
				wins: 0,
				losses: 0
			};
			count(entry);
			matchups.set(key, entry);
		}

		if (me.matchtype_id !== null) {
			const entry = modes.get(me.matchtype_id) ?? {
				matchtypeId: me.matchtype_id,
				wins: 0,
				losses: 0
			};
			count(entry);
			modes.set(me.matchtype_id, entry);
		}
	}

	return {
		...summary,
		matchCount: summary.wins + summary.losses,
		byMatchup: [...matchups.values()].sort(byGames),
		byMode: [...modes.values()].sort(byGames)
	};
}
