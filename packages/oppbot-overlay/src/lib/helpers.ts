import type { LeaderboardStat, MatchHistoryEntry, Player } from './types';

export const LEADERBOARD_IDS: Record<string, number> = {
	'Custom Game_us': 0,
	'Custom Game_heer': 1,
	'Custom Game_brit': 2,
	'Custom Game_panzer': 3,
	'1v1_us': 4,
	'1v1_heer': 5,
	'1v1_brit': 6,
	'1v1_panzer': 7,
	'2v2_us': 8,
	'2v2_heer': 9,
	'2v2_brit': 10,
	'2v2_panzer': 11,
	'3v3_us': 12,
	'3v3_heer': 13,
	'3v3_brit': 14,
	'3v3_panzer': 15,
	'4v4_us': 16,
	'4v4_heer': 17,
	'4v4_brit': 18,
	'4v4_panzer': 19,
	'Comp Stomp_us': 42,
	'Comp Stomp_heer': 43,
	'Comp Stomp_brit': 44,
	'Comp Stomp_panzer': 45
};

export const MATCH_TYPES: Record<number, string> = {
	0: 'Custom Game',
	1: '1v1',
	2: '2v2',
	3: '3v3',
	4: '4v4',
	5: '2v2 AT',
	6: '3v3 AT',
	7: '4v4 AT',
	8: 'Assault 2v2',
	9: 'Assault 2v2 AT',
	10: 'Assault 3v3 AT',
	11: 'Panzerkrieg 2v2',
	12: 'Panzerkrieg 2v2 AT',
	13: 'Panzerkrieg 3v3 AT',
	14: 'Comp Stomp',
	15: 'Assault',
	16: 'Panzerkrieg',
	17: 'Stonewall'
};

export function getRacePrefix(race: number): string {
	switch (race) {
		case 0:
			return 'us';
		case 1:
			return 'heer';
		case 2:
			return 'brit';
		case 3:
			return 'panzer';
		default:
			return 'us';
	}
}

export function getLeaderboardStat(
	type: number,
	player: Pick<Player, 'race' | 'profile'>
): LeaderboardStat | null {
	const prefix = getRacePrefix(player.race);
	const matchLabel = MATCH_TYPES[type];
	if (!matchLabel) {
		return null;
	}

	const leaderBoardId = LEADERBOARD_IDS[`${matchLabel}_${prefix}`];
	const statGroup = player.profile?.leaderboardStats?.find(
		(stat) => stat.leaderboard_id === leaderBoardId
	);

	return statGroup ?? null;
}

export function getStoredEloRating(
	elo: Player['storedElo'],
	matchType: number,
	race: number
): number | null {
	const rating = elo?.[String(matchType)]?.[String(race)]?.rating;
	if (typeof rating !== 'number' || rating < 1) {
		return null;
	}

	return rating;
}

function eloTypesToTry(matchType: number): number[] {
	if (matchType === 0 || matchType === 14) {
		return [matchType, 1, 2, 3, 4];
	}

	return [matchType];
}

export function getPlayerEloFromMatchHistory(matchType: number, player: Player): number | null {
	const history = player.matchHistory;
	if (!history?.length) {
		return null;
	}

	const profileId = player.playerId ?? player.profile?.profile_id;
	if (profileId == null) {
		return null;
	}

	let elo: number | null = null;
	let latestCompletion = -1;

	for (const match of history) {
		if (match.matchtype_id !== matchType) {
			continue;
		}

		const entry = match.players?.find(
			(p) => p.profile_id === profileId && p.race_id === player.race
		);
		if (!entry || typeof entry.newrating !== 'number' || entry.newrating < 1) {
			continue;
		}

		const completed = match.completiontime ?? match.startgametime ?? 0;
		if (completed >= latestCompletion) {
			latestCompletion = completed;
			elo = entry.newrating;
		}
	}

	return elo;
}

/** Custom / skirmish overlays look up type 0/14 first, then 1v1–4v4 and stored ratings. */
export function resolvePlayerElo(matchType: number, player: Player): number | null {
	for (const type of eloTypesToTry(matchType)) {
		const fromHistory = getPlayerEloFromMatchHistory(type, player);
		if (fromHistory != null) {
			return fromHistory;
		}

		const fromStored = getStoredEloRating(player.storedElo, type, player.race);
		if (fromStored != null) {
			return fromStored;
		}
	}
	return null;
}
