import { getModeLabel, getRaceLabel, normalizeMapName } from '../format/player-format';

/** What a reward condition counts. Match metrics add up over every Steam id on the account. */
export const REWARD_METRICS = [
	'matches_played',
	'wins',
	'upset_wins',
	'win_streak',
	'elo_reached',
	'hours_played',
	'matches_recorded',
	'reputation',
	'comments_created',
	'replies_created',
	'votes_cast',
	'replays_uploaded',
	'replay_likes_received',
	'replay_downloads_received',
	'replays_downloaded',
	'comment_upvotes_received',
	'player_upvotes_received',
	'profile_complete',
	'account_age_days',
	'hours_streamed',
	'fair_play_matches',
	'overlay_published'
] as const;

export type RewardMetric = (typeof REWARD_METRICS)[number];

export type RewardFilterKey =
	| 'raceId'
	| 'matchtypeId'
	| 'ranked'
	| 'map'
	| 'minMinutes'
	| 'maxMinutes'
	| 'pro'
	| 'minAvgElo';

export type RewardConditionFilter = {
	raceId?: number;
	matchtypeId?: number;
	ranked?: boolean;
	/** Raw map key, as stored on match rows. */
	map?: string;
	minMinutes?: number;
	maxMinutes?: number;
	pro?: boolean;
	minAvgElo?: number;
};

export type RewardCondition = {
	metric: RewardMetric;
	threshold: number;
	filter?: RewardConditionFilter;
};

export const REWARD_CONDITIONS_MAX = 5;

const MATCH_FILTERS: readonly RewardFilterKey[] = [
	'raceId',
	'matchtypeId',
	'ranked',
	'map',
	'minMinutes',
	'maxMinutes',
	'pro',
	'minAvgElo'
];

export type RewardMetricInfo = {
	label: string;
	filters: readonly RewardFilterKey[];
	/** Yes/no: the threshold is always 1. */
	boolean?: boolean;
	/** What the threshold means, for the admin form. */
	unit?: string;
};

/** Metric → English label, the filters it supports and its threshold unit. */
export const REWARD_METRIC_CATALOG: Record<RewardMetric, RewardMetricInfo> = {
	matches_played: { label: 'Matches played', filters: MATCH_FILTERS },
	wins: { label: 'Wins', filters: MATCH_FILTERS },
	upset_wins: { label: 'Upset wins (1v1)', filters: ['raceId'] },
	win_streak: { label: 'Longest win streak', filters: ['raceId', 'matchtypeId', 'ranked'] },
	elo_reached: { label: 'Rating reached', filters: ['raceId', 'matchtypeId'], unit: 'ELO' },
	hours_played: { label: 'Hours played', filters: [], unit: 'Hours' },
	matches_recorded: { label: 'Matches recorded', filters: [] },
	reputation: { label: 'Reputation', filters: [] },
	comments_created: { label: 'Comments placed', filters: [] },
	replies_created: { label: 'Replies placed', filters: [] },
	votes_cast: { label: 'Upvotes given', filters: [] },
	replays_uploaded: { label: 'Replays uploaded', filters: [] },
	replay_likes_received: { label: 'Replay upvotes received', filters: [] },
	replay_downloads_received: { label: 'Replay downloads received', filters: [] },
	replays_downloaded: { label: 'Replays downloaded', filters: [] },
	comment_upvotes_received: { label: 'Comment upvotes received', filters: [] },
	player_upvotes_received: { label: 'Player upvotes received', filters: [] },
	profile_complete: { label: 'Profile complete', filters: [], boolean: true },
	account_age_days: { label: 'Account age (days)', filters: [], unit: 'Days' },
	hours_streamed: { label: 'Hours streamed', filters: [], unit: 'Hours' },
	fair_play_matches: { label: 'Fair play matches', filters: [] },
	overlay_published: { label: 'Overlay published', filters: [], boolean: true }
};

export const REWARD_RACE_IDS = [0, 1, 2, 3] as const;

/** Match types that count toward stats (Skirmish never counts). */
export const REWARD_MATCHTYPE_IDS = [
	0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17
] as const;

/** Metric + filter: unique within one reward. */
export function rewardConditionKey(condition: Pick<RewardCondition, 'metric' | 'filter'>): string {
	const filter = Object.entries(condition.filter ?? {})
		.filter(([, value]) => value !== undefined)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}=${value}`);
	return [condition.metric, ...filter].join(':');
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** "Wins · British Forces · 1 VS. 1 · Ranked · ≥ 60 min" */
export function formatRewardCondition(condition: RewardCondition, t: Translate): string {
	const parts = [t(REWARD_METRIC_CATALOG[condition.metric]?.label ?? condition.metric)];
	const filter = condition.filter ?? {};
	if (filter.raceId !== undefined) {
		parts.push(getRaceLabel(filter.raceId));
	}

	if (filter.matchtypeId !== undefined) {
		parts.push(getModeLabel(filter.matchtypeId));
	}

	if (filter.ranked !== undefined) {
		parts.push(filter.ranked ? t('Ranked') : t('Unranked'));
	}

	if (filter.map) {
		parts.push(normalizeMapName(filter.map, false));
	}

	if (filter.minMinutes !== undefined) {
		parts.push(t('≥ {minutes} min', { minutes: filter.minMinutes }));
	}

	if (filter.maxMinutes !== undefined) {
		parts.push(t('≤ {minutes} min', { minutes: filter.maxMinutes }));
	}

	if (filter.pro) {
		parts.push(t('Pro lobby'));
	}

	if (filter.minAvgElo !== undefined) {
		parts.push(t('Avg ELO ≥ {elo}', { elo: filter.minAvgElo }));
	}

	return parts.join(' · ');
}
