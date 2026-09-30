/** Ranked 1v1, 2v2, 3v3, 4v4 (including AT). */
const RANKED_STANDARD_MATCH_TYPES = new Set([1, 2, 3, 4, 5, 6, 7]);
const MATCH_TYPE_1V1 = 1;
export const RANKED_1V1_PRO_GAMEPLAY_ELO = 1800;
export const RANKED_PRO_GAMEPLAY_ELO = 1850;

export type MatchEloPlayer = {
	oldrating?: number;
	newrating?: number;
};

export type MatchEloSource = {
	isRanked?: boolean;
	players?: unknown[];
	result?: { players?: MatchEloPlayer[]; matchtype_id?: number } | null;
};

function playerMatchElo(player: MatchEloPlayer): number | null {
	const previous = Number(player.oldrating);
	if (Number.isFinite(previous) && previous >= 1) {
		return previous;
	}

	const next = Number(player.newrating);
	if (Number.isFinite(next) && next >= 1) {
		return next;
	}

	return null;
}

function rankedPlayerCount(count: number): boolean {
	return count === 2 || count === 4 || count === 6 || count === 8;
}

export function isRankedStandardMatch(match: MatchEloSource): boolean {
	if (!match.isRanked) {
		return false;
	}

	const matchType = Number(match.result?.matchtype_id);
	if (Number.isInteger(matchType) && RANKED_STANDARD_MATCH_TYPES.has(matchType)) {
		return true;
	}

	const players = match.result?.players?.length || match.players?.length || 0;
	return rankedPlayerCount(players);
}

function isRanked1v1(match: MatchEloSource): boolean {
	const matchType = Number(match.result?.matchtype_id);
	if (matchType === MATCH_TYPE_1V1) {
		return true;
	}

	if (Number.isInteger(matchType) && RANKED_STANDARD_MATCH_TYPES.has(matchType)) {
		return false;
	}

	const players = match.result?.players?.length || match.players?.length || 0;
	return players === 2;
}

export function getProGameplayEloThreshold(match: MatchEloSource): number {
	return isRanked1v1(match) ? RANKED_1V1_PRO_GAMEPLAY_ELO : RANKED_PRO_GAMEPLAY_ELO;
}

export function getMatchAverageElo(match: MatchEloSource): number | null {
	const players = match.result?.players;
	if (!players?.length) {
		return null;
	}

	const ratings: number[] = [];
	for (const player of players) {
		const rating = playerMatchElo(player);
		if (rating != null) {
			ratings.push(rating);
		}
	}
	if (ratings.length < 2) {
		return null;
	}

	if (ratings.length < players.length / 2) {
		return null;
	}

	return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

export function isProGameplayMatch(match: MatchEloSource): boolean {
	if (!isRankedStandardMatch(match)) {
		return false;
	}

	const average = getMatchAverageElo(match);
	return average != null && average >= getProGameplayEloThreshold(match);
}
