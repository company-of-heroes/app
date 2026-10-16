/** Derived views of one ladder for the side panel and the table's filters. Pure functions. */
import type { LeaderboardRankChange, LeaderboardStatRow } from '../format/types';

export type LeaderboardPeriod = 'day' | 'week';

export type LeaderboardSortKey = 'rank' | 'change' | 'elo' | 'games' | 'winrate' | 'streak';

/** `reverse: false` is best first for every key (rank 1, biggest climb, highest ELO, …). */
export type LeaderboardSort = { key: LeaderboardSortKey; reverse: boolean };

export const DEFAULT_SORT: LeaderboardSort = { key: 'rank', reverse: false };

export type LeaderboardFilters = {
	query: string;
	country: string | null;
	minGames: number;
};

export const DEFAULT_FILTERS: LeaderboardFilters = { query: '', country: null, minGames: 0 };

export function games(stat: LeaderboardStatRow): number {
	return stat.wins + stat.losses;
}

export function winRate(stat: LeaderboardStatRow): number {
	const total = games(stat);
	return total > 0 ? stat.wins / total : 0;
}

export function steamIdOf(stat: LeaderboardStatRow): string {
	return stat.profile.name.replace('/steam/', '');
}

/** Week movement when a week-old snapshot exists, otherwise the day's. */
export function periodChange(
	stat: LeaderboardStatRow,
	period: LeaderboardPeriod
): LeaderboardRankChange | null {
	return stat.change?.[period] ?? null;
}

/** The period the side panel compares against: a week once a week-old snapshot exists. */
export function highlightPeriod(stats: LeaderboardStatRow[]): LeaderboardPeriod | null {
	if (stats.some((stat) => stat.change?.week)) {
		return 'week';
	}

	return stats.some((stat) => stat.change?.day) ? 'day' : null;
}

export function climbers(stats: LeaderboardStatRow[], period: LeaderboardPeriod, limit = 5) {
	return stats
		.filter((stat) => (periodChange(stat, period)?.rank ?? 0) > 0)
		.sort((a, b) => (periodChange(b, period)?.rank ?? 0) - (periodChange(a, period)?.rank ?? 0))
		.slice(0, limit);
}

export function fallers(stats: LeaderboardStatRow[], period: LeaderboardPeriod, limit = 5) {
	return stats
		.filter((stat) => (periodChange(stat, period)?.rank ?? 0) < 0)
		.sort((a, b) => (periodChange(a, period)?.rank ?? 0) - (periodChange(b, period)?.rank ?? 0))
		.slice(0, limit);
}

/** Players not in the top 200 of the snapshot, best rank first. */
export function newcomers(stats: LeaderboardStatRow[], period: LeaderboardPeriod, limit = 5) {
	return stats.filter((stat) => stat.change?.[period]?.rank === null).slice(0, limit);
}

/** Longest current win streaks (3 or more). */
export function hotStreaks(stats: LeaderboardStatRow[], limit = 5) {
	return stats
		.filter((stat) => stat.streak >= 3)
		.sort((a, b) => b.streak - a.streak || a.rank - b.rank)
		.slice(0, limit);
}

/** Players per country, most first; players without a country are left out. */
export function countryCounts(stats: LeaderboardStatRow[]): { country: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const stat of stats) {
		const country = stat.profile.country?.toLowerCase();
		if (country) {
			counts.set(country, (counts.get(country) ?? 0) + 1);
		}
	}

	return [...counts]
		.map(([country, count]) => ({ country, count }))
		.sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}

export function isFiltered(filters: LeaderboardFilters, sort: LeaderboardSort): boolean {
	return (
		filters.query.trim() !== '' ||
		filters.country !== null ||
		filters.minGames > 0 ||
		sort.key !== DEFAULT_SORT.key ||
		sort.reverse !== DEFAULT_SORT.reverse
	);
}

export function filterStats(
	stats: LeaderboardStatRow[],
	filters: LeaderboardFilters
): LeaderboardStatRow[] {
	const query = filters.query.trim().toLowerCase();
	return stats.filter(
		(stat) =>
			(!query || stat.profile.alias.toLowerCase().includes(query)) &&
			(!filters.country || stat.profile.country?.toLowerCase() === filters.country) &&
			games(stat) >= filters.minGames
	);
}

/** Sorted copy; rows without a value for the key (no ELO, no snapshot) always go last. */
export function sortStats(
	stats: LeaderboardStatRow[],
	sort: LeaderboardSort,
	elo: (stat: LeaderboardStatRow) => number | null
): LeaderboardStatRow[] {
	if (sort.key === 'rank' && !sort.reverse) {
		return stats;
	}

	const value = (stat: LeaderboardStatRow): number | null => {
		switch (sort.key) {
			case 'change':
				return stat.change?.day?.rank ?? null;
			case 'elo':
				return elo(stat);
			case 'games':
				return games(stat);
			case 'winrate':
				return winRate(stat);
			case 'streak':
				return stat.streak;
			default:
				return -stat.rank;
		}
	};
	const direction = sort.reverse ? -1 : 1;
	return [...stats].sort((a, b) => {
		const left = value(a);
		const right = value(b);
		if (left === null || right === null) {
			return (left === null ? 1 : 0) - (right === null ? 1 : 0) || a.rank - b.rank;
		}

		return direction * (right - left) || a.rank - b.rank;
	});
}
