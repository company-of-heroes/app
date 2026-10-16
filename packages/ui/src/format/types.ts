export type PlayerLabel = {
	id: string;
	name: string;
	color: string;
	sort?: number;
	/** Shown on hover; empty shows none. */
	tooltip?: string;
	/** Stable identifier of a system label, e.g. `supporter`. */
	key?: string | null;
	/** Managed by the product: cannot be deleted or assigned by hand. */
	system?: boolean;
};

export type PlayerEloSlot = {
	rating: number;
	matchId: number;
	at: number;
};

export type PlayerEloMap = Record<string, Record<string, PlayerEloSlot>>;

/** Movement since a stored ladder snapshot: `rank` > 0 climbed, < 0 dropped, null is new to the top 200. */
export type LeaderboardRankChange = { rank: number | null; games: number };

export type LeaderboardStatRow = {
	leaderboard_id: number;
	rank: number;
	ranklevel: number;
	wins: number;
	losses: number;
	streak: number;
	profile: {
		profile_id: number;
		alias: string;
		country: string | null;
		name: string;
		avatarUrl?: string;
		labels?: PlayerLabel[];
		likeCount?: number;
		/** An account linked this Steam id; `false` shows the claim button, unknown shows none. */
		claimed?: boolean;
	};
	/** Since yesterday's / last week's snapshot; null (or left out) when there is none yet. */
	change?: { day: LeaderboardRankChange | null; week: LeaderboardRankChange | null };
};
