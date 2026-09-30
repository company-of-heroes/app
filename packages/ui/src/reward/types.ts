import type { RewardCondition } from './metrics';

export type RewardConditionProgress = RewardCondition & {
	/** Current value, not capped at the threshold. */
	value: number;
};

export type RewardProgress = {
	/** 0–1: the least-complete condition, since all of them must be met. */
	overall: number;
	conditions: RewardConditionProgress[];
};

/** One reward as a viewer sees it. */
export type RewardView = {
	id: string;
	title: string;
	description: string;
	imageUrl: string | null;
	/** Title and description stay hidden until unlocked. */
	secret: boolean;
	sort: number;
	/** ISO date, null while locked. */
	unlockedAt: string | null;
	/** Only for the owner's own rewards. */
	progress?: RewardProgress;
};

export type PlayerRewards = {
	/** The viewer owns this account: locked rewards and progress are included. */
	owned: boolean;
	/** False when the Steam id is not linked to an account. */
	linked: boolean;
	rewards: RewardView[];
};
