export type RelicProfile = {
	profile_id: number;
	name: string;
	personal_statgroup_id: number;
	xp: number;
	level: number;
	leaderboardregion_id: number;
	country: string;
	leaderboardStats?: LeaderboardStat[];
};

export type Result = {
	code: number;
	message: string;
};

// Assuming members contain RelicProfile based on context, adjust if needed
export type StatGroup = {
	id: number;
	name: string;
	type: number;
	members: RelicProfile[]; // Or specify a more concrete type if known, e.g., RelicProfile[]
};

export type LeaderboardStat = {
	statgroup_id: number;
	leaderboard_id: number;
	wins: number;
	losses: number;
	streak: number;
	disputes: number;
	drops: number;
	rank: number;
	ranktotal: number;
	ranklevel: number;
	regionrank: number;
	regionranktotal: number;
	lastmatchdate: number; // Unix timestamp
	highestrank: number;
	highestranklevel: number;
};

export type PersonalStat = {
	result: Result;
	statGroups: StatGroup[];
	leaderboardStats: LeaderboardStat[];
};
