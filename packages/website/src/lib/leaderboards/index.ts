import type { LeaderboardStatRow } from '@company-of-heroes/ui/format/types';
import type { PlayerEloMap } from '$lib/player';

export type RelicLeaderboardProfile = LeaderboardStatRow['profile'];

export type LeaderboardStatWithProfile = LeaderboardStatRow;

export type LeaderboardPageData = {
	leaderboardId: number;
	stats: LeaderboardStatWithProfile[];
	eloBySteamId: Record<string, PlayerEloMap>;
	/** Days (UTC) of the snapshots `change` compares against; null until one is stored. */
	baselines?: { day: string | null; week: string | null };
};

export {
	boardIdForMode,
	DEFAULT_BOARD_ID,
	getModeForBoard,
	LEADERBOARD_MODES,
	parseBoardId,
	type LeaderboardFaction,
	type LeaderboardMode
} from '@company-of-heroes/ui/leaderboard/modes';
