import type { CompareAccount, CompareData } from '@company-of-heroes/api/compare';
import type { HeadToHead } from '@company-of-heroes/api/head-to-head';
import type { PlayerPerformance } from '@company-of-heroes/api/player-performance';
import type { CompareBestElo, CompareBestRank, CompareView } from './types';

type WinLoss = { wins: number; losses: number };

const MAP_LIMIT = 8;
const FORM_LIMIT = 10;
const GAME_LIMIT = 100;

const byGames = (a: WinLoss, b: WinLoss) => b.wins + b.losses - (a.wins + a.losses);
const isRankedMode = (matchtypeId: number) => matchtypeId >= 1 && matchtypeId <= 4;

/** Sums win/loss rows that share a key. */
function sumBy<T extends WinLoss>(rows: T[], key: (row: T) => string | number): T[] {
	const sums = new Map<string | number, T>();
	for (const row of rows) {
		const k = key(row);
		const sum = sums.get(k);
		sums.set(k, sum ? { ...sum, wins: sum.wins + row.wins, losses: sum.losses + row.losses } : row);
	}

	return [...sums.values()];
}

/** Per leaderboard the lowest positive rank across the accounts; ties go to more wins. */
function bestRanks(accounts: CompareData['mine']): CompareBestRank[] {
	const best = new Map<number, CompareBestRank>();
	for (const { steamId, leaderboardStats } of accounts) {
		for (const stat of leaderboardStats) {
			if (!(stat.rank > 0)) {
				continue;
			}

			const current = best.get(stat.leaderboard_id);
			const beaten =
				!current ||
				stat.rank < current.rank ||
				(stat.rank === current.rank && stat.wins > current.wins);
			if (beaten) {
				best.set(stat.leaderboard_id, {
					leaderboardId: stat.leaderboard_id,
					rank: stat.rank,
					ranklevel: stat.ranklevel,
					wins: stat.wins,
					losses: stat.losses,
					steamId
				});
			}
		}
	}

	return [...best.values()].sort((a, b) => a.leaderboardId - b.leaderboardId);
}

/** Per mode + faction the highest rating across the accounts. */
function bestElo(accounts: CompareData['mine']): CompareBestElo[] {
	const best = new Map<string, CompareBestElo>();
	for (const { steamId, elo } of accounts) {
		for (const [matchKey, races] of Object.entries(elo)) {
			for (const [raceKey, slot] of Object.entries(races)) {
				const key = `${matchKey}:${raceKey}`;
				if (slot.rating > (best.get(key)?.rating ?? 0)) {
					best.set(key, { matchKey, raceKey, rating: slot.rating, steamId });
				}
			}
		}
	}

	return [...best.values()].sort(
		(a, b) => Number(a.matchKey) - Number(b.matchKey) || Number(a.raceKey) - Number(b.raceKey)
	);
}

/** The server counts a match once across accounts, so the per-account records just add up. */
function combinePerformance(records: PlayerPerformance[]): PlayerPerformance {
	const wins = records.reduce((total, record) => total + record.wins, 0);
	const losses = records.reduce((total, record) => total + record.losses, 0);
	return {
		matchCount: wins + losses,
		wins,
		losses,
		recentMatches: records
			.flatMap((record) => record.recentMatches)
			.sort((a, b) => b.sessionId - a.sessionId)
			.slice(0, FORM_LIMIT),
		byMap: sumBy(
			records.flatMap((record) => record.byMap),
			(row) => row.map
		)
			.sort(byGames)
			.slice(0, MAP_LIMIT),
		byFaction: sumBy(
			records.flatMap((record) => record.byFaction),
			(row) => row.raceId
		).sort(byGames),
		byMode: sumBy(
			records.flatMap((record) => record.byMode),
			(row) => row.matchtypeId
		).sort((a, b) =>
			isRankedMode(a.matchtypeId) !== isRankedMode(b.matchtypeId)
				? isRankedMode(a.matchtypeId)
					? -1
					: 1
				: a.matchtypeId - b.matchtypeId
		)
	};
}

function combineHeadToHead(profileId: number, records: HeadToHead[]): HeadToHead {
	const wins = records.reduce((total, record) => total + record.wins, 0);
	const losses = records.reduce((total, record) => total + record.losses, 0);
	const last = records.flatMap((record) => (record.lastSessionId ? [record.lastSessionId] : []));
	return {
		profileId,
		matchCount: wins + losses,
		wins,
		losses,
		lastSessionId: last.length > 0 ? Math.max(...last) : null,
		byMatchup: sumBy(
			records.flatMap((record) => record.byMatchup),
			(row) => `${row.raceId}:${row.theirRaceId}`
		).sort(byGames),
		byMode: sumBy(
			records.flatMap((record) => record.byMode),
			(row) => row.matchtypeId
		).sort(byGames),
		games: records
			.flatMap((record) => record.games)
			.sort((a, b) => b.sessionId - a.sessionId)
			.slice(0, GAME_LIMIT)
	};
}

/** The selected accounts combined into one "me" against them; runs in the browser on every toggle. */
export function combineCompare(data: CompareData, selected: string[]): CompareView {
	const mine = data.mine.filter((account) => selected.includes(account.steamId));
	return {
		accounts: data.accounts,
		isSelf: data.isSelf,
		me: {
			performance: combinePerformance(mine.map((account) => account.performance)),
			best: bestRanks(mine),
			elo: bestElo(mine)
		},
		them: data.them,
		headToHead: combineHeadToHead(
			data.them.profileId,
			mine.map((account) => account.headToHead)
		)
	};
}

/** The `?accounts=` selection: those of the user's accounts it names, or all of them. */
export function selectionFromParam(accounts: CompareAccount[], param: string | null): string[] {
	const named = new Set(param?.split(',').filter(Boolean) ?? []);
	const picked = accounts.filter((account) => named.has(account.steamId));
	return (picked.length > 0 ? picked : accounts).map((account) => account.steamId);
}

/** The ids for `?accounts=`, or `undefined` when every account is selected. */
export function selectionParam(
	accounts: CompareAccount[],
	selected: string[]
): string[] | undefined {
	return selected.length === accounts.length ? undefined : selected;
}
