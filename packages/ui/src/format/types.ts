export type PlayerLabel = {
	id: string;
	name: string;
	color: string;
	sort?: number;
	/** Shown on hover; empty shows none. */
	tooltip?: string;
};

export type PlayerEloSlot = {
	rating: number;
	matchId: number;
	at: number;
};

export type PlayerEloMap = Record<string, Record<string, PlayerEloSlot>>;

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
	};
};
