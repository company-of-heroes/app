import type { CommunityMatch, ReplaysQuery } from '../replay/types';
import type { DiscoverThemeId } from './types';
import { isProGameplayMatch } from '../replay/utils';

/** Human players (CPU slots excluded). */
export function humanPlayerCount(match: CommunityMatch): number {
	return match.players.filter((player) => (player.playerId ?? 0) !== -1).length;
}

/** `2v2` style label from the roster, or null for uneven or empty games. */
export function matchupLabel(match: CommunityMatch): string | null {
	const count = humanPlayerCount(match);
	if (count < 2 || count % 2 !== 0) {
		return null;
	}

	return `${count / 2}v${count / 2}`;
}

export function isPro(match: CommunityMatch): boolean {
	return isProGameplayMatch(match);
}

/** Unix seconds of a PocketBase datetime, or null. */
export function unixSeconds(value: string | undefined): number | null {
	if (!value) {
		return null;
	}

	const time = Date.parse(value.includes('T') ? value : value.replace(' ', 'T'));
	return Number.isFinite(time) ? Math.floor(time / 1000) : null;
}

/** The archive filters behind a Discover theme's "View all" (duration in minutes). */
export function themeArchiveQuery(theme: DiscoverThemeId): Partial<ReplaysQuery> {
	switch (theme) {
		case 'pro-1v1':
			return { pro: true, matchups: ['1v1'] };
		case 'big-battles':
			return { matchups: ['3v3', '4v4'], duration: { op: 'gte', value: 30 } };
		case 'fast':
			return { duration: { op: 'lt', value: 12 } };
		case 'discussed':
			return { sort: 'commentCount', sortDir: 'desc' };
	}
}
