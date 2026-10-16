/**
 * Rank movement on a Relic ladder: today's top 200 against a stored daily snapshot
 * (`leaderboard_snapshots`). Pure functions; the leaderboard service does the reads.
 */

/** One player in a stored snapshot. */
export type SnapshotRow = { p: number; r: number; w: number; l: number };

export type LadderSnapshot = { day: string; rows: SnapshotRow[] };

/** Movement since a snapshot: `rank` > 0 climbed, < 0 dropped, null was not in that top 200. */
export type RankChange = { rank: number | null; games: number };

type RankedRow = { rank: number; wins: number; losses: number; profile: { profile_id: number } };

const DAY_MS = 86_400_000;

/** UTC day (`2026-10-15`) of `at`, optionally `offset` days earlier. */
export function utcDay(at: number, offset = 0): string {
	return new Date(at - offset * DAY_MS).toISOString().slice(0, 10);
}

export function snapshotRows(stats: RankedRow[]): SnapshotRow[] {
	return stats.map((stat) => ({
		p: stat.profile.profile_id,
		r: stat.rank,
		w: stat.wins,
		l: stat.losses
	}));
}

/**
 * The snapshots to compare against, from a newest-first list: `day` is the latest from before
 * today, `week` the latest at least seven days old. Either is null until the job stored one.
 */
export function pickBaselines(
	snapshots: LadderSnapshot[],
	today: string
): { day: LadderSnapshot | null; week: LadderSnapshot | null } {
	const weekAgo = utcDay(Date.parse(today), 7);
	return {
		day: snapshots.find((snapshot) => snapshot.day < today) ?? null,
		week: snapshots.find((snapshot) => snapshot.day <= weekAgo) ?? null
	};
}

export function rankChange(stat: RankedRow, baseline: Map<number, SnapshotRow>): RankChange {
	const before = baseline.get(stat.profile.profile_id);
	if (!before) {
		return { rank: null, games: 0 };
	}

	return {
		rank: before.r - stat.rank,
		games: Math.max(0, stat.wins + stat.losses - before.w - before.l)
	};
}

export function byProfile(snapshot: LadderSnapshot | null): Map<number, SnapshotRow> | null {
	return snapshot ? new Map(snapshot.rows.map((row) => [row.p, row])) : null;
}
