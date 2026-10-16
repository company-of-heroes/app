/** An account's Paddle supporter subscription, as the account and the website see it. */
export type SupporterStatus = {
	/** `active` or `past_due`, and the paid period has not ended. */
	active: boolean;
	/** Stored subscription status (`active` | `past_due` | `paused` | `canceled`), or null without one. */
	status: string | null;
	/** Earliest payment (ISO), or null before the first one. */
	since: string | null;
	/** Paid months: one per completed payment. */
	months: number;
	/** End of the current paid period (ISO), or null. */
	currentPeriodEnd: string | null;
	/** Hidden from the public supporters page (the medal stays). */
	hidden: boolean;
};

/** One account on the public supporters page (its main Steam ID). */
export type SupporterEntry = {
	steamId: string;
	alias: string;
	avatarUrl: string | null;
	/** Paid months. */
	months: number;
	/** First payment (ISO). */
	since: string;
};

export type SupportersList = {
	/** Active subscribers: most months first, then earliest. */
	current: SupporterEntry[];
	/** Accounts that paid before and are not active now. */
	former: SupporterEntry[];
};
