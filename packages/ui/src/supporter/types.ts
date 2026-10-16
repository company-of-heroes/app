import type { PlayerLabel } from '../format/types';

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
	/** When a subscription cancelled at period end stops (ISO), or null while it renews. */
	endsAt: string | null;
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

/** One faction on the player card: best ranked ladder of that army, or nulls when unranked. */
export type PlayerCardFaction = {
	/** 0 US, 1 Wehrmacht, 2 British, 3 Panzer Elite. */
	raceId: number;
	/** Highest stored ELO on the faction's ranked ladders. */
	elo: number | null;
	/** Ladder position on the faction's best ranked ladder (highest rank level). */
	rank: number | null;
	/** Relic rank level (1–20) of that ladder, for the rank badge. */
	rankLevel: number | null;
	/** That ladder (`leaderboard_id`), for its mode label. */
	leaderboardId: number | null;
};

/** A ribbon on the card by its `shared-assets/ribbons` key; hosts resolve the image. */
export type PlayerCardRibbon = {
	key: string;
	title: string;
};

/** The supporter player card (page and PNG); only active supporters have one. */
export type PlayerCardData = {
	steamId: string;
	alias: string;
	/** Steam avatar; null shows the placeholder. */
	avatarUrl: string | null;
	country: string | null;
	/** Labels next to the name (the supporter label included). */
	labels: PlayerLabel[];
	/** Always the four armies, in race order. */
	factions: PlayerCardFaction[];
	/** Ranked wins / (wins + losses), 0–1; null without ranked games. */
	winRate: number | null;
	/** Ranked games played. */
	matches: number;
	/** Latest unlocked ribbons, newest first (at most 5). */
	ribbons: PlayerCardRibbon[];
	supporterMonths: number;
	/** First payment (ISO). */
	supporterSince: string;
};
