import type { EloMap } from './ratings';
import type { HeadToHead, HeadToHeadRow } from './head-to-head';
import type { PerformanceRow, PlayerPerformance } from './performance';
import type { LeaderboardStat } from './relic-matches';

export type CompareAccount = {
	steamId: string;
	name: string | null;
	avatarUrl: string | null;
	profileId: number | null;
};

/** One linked account's own numbers; the page combines the selected ones. */
export type CompareAccountData = {
	steamId: string;
	leaderboardStats: LeaderboardStat[];
	elo: EloMap;
	/** Every map (no top 8), so combined accounts rank maps correctly. */
	performance: PlayerPerformance;
	headToHead: HeadToHead;
};

export type Compare = {
	/** Every linked account, for the toggles. */
	accounts: CompareAccount[];
	/** True when `them` is one of the user's own accounts; `mine` then has no head to head. */
	isSelf: boolean;
	mine: CompareAccountData[];
	them: {
		steamId: string;
		profileId: number;
		alias: string;
		avatarUrl: string | null;
		country: string | null;
		level: number;
		leaderboardStats: LeaderboardStat[];
		elo: EloMap;
		performance: PlayerPerformance;
	};
};

/** One `lobby_player_index` row with the fields both summaries need, plus its account. */
export type CompareRow = PerformanceRow & HeadToHeadRow & { steam_id: string };

export const COMPARE_ROW_FIELDS =
	'id,lobby,session_id,profile_id,steam_id,outcome,race_id,matchtype_id,map';

/**
 * Splits the user's rows per account after keeping one row per session (first by id), so a
 * match played on two linked accounts is counted once whichever accounts are combined.
 */
export function rowsPerAccount(rows: CompareRow[]): Map<string, CompareRow[]> {
	const sessions = new Map<number, CompareRow>();
	for (const row of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
		if (!sessions.has(row.session_id)) {
			sessions.set(row.session_id, row);
		}
	}

	const perAccount = new Map<string, CompareRow[]>();
	for (const row of sessions.values()) {
		perAccount.set(row.steam_id, [...(perAccount.get(row.steam_id) ?? []), row]);
	}

	return perAccount;
}
