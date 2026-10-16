import type { CommunityMatch } from '@company-of-heroes/ui/replay/types';
import { isProGameplayMatch } from '@company-of-heroes/ui/replay/utils';
import type { FilterAst } from './history-filter';

/** Discover theme rows, in page order. */
export const DISCOVER_THEMES = ['pro-1v1', 'big-battles', 'fast', 'discussed'] as const;
export type DiscoverThemeId = (typeof DISCOVER_THEMES)[number];

export const FEATURED_COUNT = 3;
export const THEME_SIZE = 6;
/** Big battles last at least this long; fast games end before `FAST_MAX_SECONDS`. */
export const BIG_BATTLE_MIN_SECONDS = 30 * 60;
export const FAST_MAX_SECONDS = 12 * 60;
/** Shorter games are drops or early leaves, not worth watching. */
export const FAST_MIN_SECONDS = 4 * 60;

/** The fields discover reads from a list row of either kind. */
export type DiscoverRow = Pick<
	CommunityMatch,
	| 'id'
	| 'isRanked'
	| 'result'
	| 'players'
	| 'likeCount'
	| 'downloadCount'
	| 'commentCount'
	| 'createdAt'
	| 'durationSeconds'
> & {
	kind?: 'match' | 'member';
	hasReplay?: boolean;
	uploadedBy?: { id: string } | null;
};

/** Community-match filter per theme; `discussed` sorts by comments instead. */
export function themeFilter(theme: DiscoverThemeId): FilterAst | null {
	switch (theme) {
		case 'pro-1v1':
			return {
				op: 'and',
				children: [
					{ field: 'pro', op: 'eq', value: true },
					{ field: 'matchup', op: 'in', value: ['1v1'] }
				]
			};
		case 'big-battles':
			return {
				op: 'and',
				children: [
					{ field: 'matchup', op: 'in', value: ['3v3', '4v4'] },
					{ field: 'duration', op: 'gte', value: BIG_BATTLE_MIN_SECONDS / 60 }
				]
			};
		case 'fast':
			return {
				op: 'and',
				children: [
					{ field: 'duration', op: 'gte', value: FAST_MIN_SECONDS / 60 },
					{ field: 'duration', op: 'lt', value: FAST_MAX_SECONDS / 60 }
				]
			};
		case 'discussed':
			return null;
	}
}

function humanPlayers(row: DiscoverRow): number {
	return row.players.filter((player) => (player.playerId ?? 0) !== -1).length;
}

/** Whether a row (usually a member replay, which the AST cannot filter) fits a theme. */
export function fitsTheme(row: DiscoverRow, theme: DiscoverThemeId): boolean {
	const duration = row.durationSeconds ?? 0;
	switch (theme) {
		case 'pro-1v1':
			return humanPlayers(row) === 2 && isProGameplayMatch(row as CommunityMatch);
		case 'big-battles':
			return humanPlayers(row) >= 6 && duration >= BIG_BATTLE_MIN_SECONDS;
		case 'fast':
			return duration >= FAST_MIN_SECONDS && duration < FAST_MAX_SECONDS;
		case 'discussed':
			return row.commentCount > 0;
	}
}

/** Watch-worthiness: downloads, votes and comments, with a lift for pro games and shared replays. */
export function featuredScore(row: DiscoverRow): number {
	return (
		(row.downloadCount ?? 0) +
		3 * (row.likeCount ?? 0) +
		2 * (row.commentCount ?? 0) +
		(isProGameplayMatch(row as CommunityMatch) ? 5 : 0) +
		(row.kind === 'member' ? 4 : 0)
	);
}

/** A community match is only watchable with its replay file. */
export function watchable(row: DiscoverRow): boolean {
	return row.kind === 'member' || row.hasReplay !== false;
}

/** The best `count` rows, at most one per uploader so the hero stays varied. */
export function pickFeatured<T extends DiscoverRow>(rows: T[], count = FEATURED_COUNT): T[] {
	const picked: T[] = [];
	const uploaders = new Set<string>();
	const ranked = rows
		.filter(watchable)
		.map((row) => ({ row, score: featuredScore(row) }))
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score || b.row.createdAt.localeCompare(a.row.createdAt));
	for (const { row } of ranked) {
		const uploader = row.uploadedBy?.id;
		if (uploader && uploaders.has(uploader)) {
			continue;
		}

		if (uploader) {
			uploaders.add(uploader);
		}

		picked.push(row);
		if (picked.length === count) {
			break;
		}
	}

	return picked;
}

/** Shared replays first, then community matches; skips rows shown elsewhere on the page. */
export function fillTheme<T extends DiscoverRow>(
	members: T[],
	matches: T[],
	taken: Set<string>,
	size = THEME_SIZE
): T[] {
	const items: T[] = [];
	for (const row of [...members, ...matches]) {
		if (items.length === size) {
			break;
		}

		if (taken.has(row.id) || !watchable(row)) {
			continue;
		}

		items.push(row);
	}

	for (const row of items) {
		taken.add(row.id);
	}

	return items;
}
