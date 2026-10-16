import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { cached } from '../cache';
import { badRequest } from '../errors';
import { fromPb, sequence, type Task } from '../result';
import {
	byProfile,
	pickBaselines,
	rankChange,
	snapshotRows,
	utcDay,
	type LadderSnapshot,
	type RankChange
} from '../domain/leaderboard-movement';
import {
	isRankedLeaderboard,
	isValidSteamId,
	steamIdFromRelicName,
	type EloMap
} from '../domain/ratings';
import type { PlayerLabel } from './player-info';
import { Service } from './service';

export type LeaderboardStat = {
	leaderboard_id: number;
	rank: number;
	ranklevel: number;
	wins: number;
	losses: number;
	streak: number;
	profile: {
		profile_id: number;
		alias: string;
		country: string | null;
		name: string;
		avatarUrl?: string;
		labels: PlayerLabel[];
		likeCount?: number;
		/** An account linked this Steam id; unclaimed players get a claim button. */
		claimed?: boolean;
	};
	/** Movement since the stored snapshots; null until the job stored one for that period. */
	change: { day: RankChange | null; week: RankChange | null };
};

export type Leaderboard = {
	leaderboardId: number;
	stats: LeaderboardStat[];
	eloBySteamId: Record<string, EloMap>;
	/** Days (UTC) of the snapshots `change` compares against. */
	baselines: { day: string | null; week: string | null };
};

type RelicLeaderboard = {
	statGroups?: {
		members?: {
			personal_statgroup_id: number;
			profile_id: number;
			alias?: string;
			country?: string;
			name?: string;
		}[];
	}[];
	leaderboardStats?: {
		statgroup_id: number;
		leaderboard_id: number;
		rank: number;
		ranklevel: number;
		wins: number;
		losses: number;
		streak: number;
	}[];
};

const TOP_WITH_AVATARS = 3;
/** 1v1 and 2v2 ladders, the player pages worth listing in the sitemap. */
const SITEMAP_BOARDS = [4, 5, 6, 7, 8, 9, 10, 11];
/** Relic's ladder moves slowly; one fetch per board per data center every few minutes. */
const CACHE_SECONDS = 300;
const RANKED_BOARDS = Array.from({ length: 16 }, (_, i) => i + 4);
/** Snapshots kept per board; a week back plus a few spare days. */
const SNAPSHOT_DAYS = 10;

function joinStats(data: RelicLeaderboard): LeaderboardStat[] {
	const members = new Map(
		(data.statGroups ?? [])
			.flatMap((group) => group.members ?? [])
			.map((member) => [member.personal_statgroup_id, member])
	);
	return (data.leaderboardStats ?? []).flatMap((stat) => {
		const member = members.get(stat.statgroup_id);
		if (!member) {
			return [];
		}

		return [
			{
				leaderboard_id: Number(stat.leaderboard_id) || 0,
				rank: Number(stat.rank) || 0,
				ranklevel: Number(stat.ranklevel) || 0,
				wins: Number(stat.wins) || 0,
				losses: Number(stat.losses) || 0,
				streak: Number(stat.streak) || 0,
				profile: {
					profile_id: Number(member.profile_id) || 0,
					alias: member.alias ?? '',
					country: member.country ?? null,
					name: member.name ?? '',
					labels: []
				},
				change: { day: null, week: null }
			}
		];
	});
}

export class LeaderboardService extends Service {
	private load(leaderboardId: number): Task<Leaderboard> {
		return this.relic
			.get<RelicLeaderboard>(
				`/community/leaderboard/getleaderboard2?title=coh1&leaderboard_id=${leaderboardId}&count=200`
			)
			.andThen((data) => {
				const stats = joinStats(data);
				const steamIds = stats.map((stat) => steamIdFromRelicName(stat.profile.name));
				const playerInfo = this.services.playerInfo;
				return ResultAsync.combine([
					playerInfo.elo(steamIds),
					playerInfo.labels(steamIds),
					playerInfo.likeCounts(steamIds),
					this.services.users.claimedSteamIds(steamIds),
					this.steam.playerSummaries(steamIds.slice(0, TOP_WITH_AVATARS).filter(isValidSteamId))
				]).map(([elo, labels, likes, claimed, avatars]) => {
					stats.forEach((stat, i) => {
						const steamId = steamIds[i];
						stat.profile.labels = labels.get(steamId) ?? [];
						stat.profile.claimed = claimed.has(steamId);
						if (likes.has(steamId)) {
							stat.profile.likeCount = likes.get(steamId);
						}

						const avatar = avatars.get(steamId)?.avatarfull;
						if (i < TOP_WITH_AVATARS && avatar) {
							stat.profile.avatarUrl = avatar;
						}
					});
					return { leaderboardId, stats, eloBySteamId: Object.fromEntries(elo) };
				});
			})
			.andThen((board) => this.withMovement(board));
	}

	/** Newest first, at most `SNAPSHOT_DAYS`. */
	private snapshots(leaderboardId: number): Task<(LadderSnapshot & { id: string })[]> {
		return fromPb(
			this.pb.collection('leaderboard_snapshots').getList<LadderSnapshot & { id: string }>(
				1,
				SNAPSHOT_DAYS + 1,
				{
					filter: this.pb.filter('board = {:board}', { board: leaderboardId }),
					sort: '-day',
					fields: 'id,day,rows'
				}
			),
			'Could not load leaderboard snapshots'
		).map((page) => page.items);
	}

	/** Rank movement against yesterday's and last week's snapshot; a failed read shows none. */
	private withMovement(board: Omit<Leaderboard, 'baselines'>): Task<Leaderboard> {
		return this.snapshots(board.leaderboardId)
			.orElse((error) => {
				console.error('[leaderboard] snapshots unavailable', error);
				return okAsync([] as LadderSnapshot[]);
			})
			.map((snapshots) => {
				const { day, week } = pickBaselines(snapshots, utcDay(Date.now()));
				const dayRows = byProfile(day);
				const weekRows = byProfile(week);
				for (const stat of board.stats) {
					stat.change = {
						day: dayRows ? rankChange(stat, dayRows) : null,
						week: weekRows ? rankChange(stat, weekRows) : null
					};
				}

				return { ...board, baselines: { day: day?.day ?? null, week: week?.day ?? null } };
			});
	}

	/** Stores today's snapshot of one board (once a day) and drops the ones past `SNAPSHOT_DAYS`. */
	private snapshotBoard(leaderboardId: number, today: string): Task<number> {
		return this.snapshots(leaderboardId).andThen((snapshots) => {
			if (snapshots[0]?.day === today) {
				return okAsync(0);
			}

			const stale = snapshots.slice(SNAPSHOT_DAYS - 1);
			const collection = this.pb.collection('leaderboard_snapshots');
			return this.get(leaderboardId)
				.andThen((board) =>
					fromPb(
						collection.create({ board: leaderboardId, day: today, rows: snapshotRows(board.stats) }),
						'Could not save leaderboard snapshot'
					)
				)
				.andThen(() =>
					sequence(stale, (snapshot) =>
						fromPb(collection.delete(snapshot.id), 'Could not prune leaderboard snapshot')
					)
				)
				.map(() => 1);
		});
	}

	/** Scheduled: today's snapshot of every ranked board that has none yet. */
	snapshotAll(): Task<{ processed: number; more: boolean }> {
		const today = utcDay(Date.now());
		return sequence(RANKED_BOARDS, (id) => this.snapshotBoard(id, today)).map((saved) => ({
			processed: saved.reduce((sum, count) => sum + count, 0),
			more: false
		}));
	}

	/**
	 * One ranked Relic ladder (ids 4-19): top 200 with stored ELO, labels, likes, claimed
	 * accounts, top-3 avatars and rank movement since the daily snapshots.
	 */
	get(leaderboardId: number): Task<Leaderboard> {
		if (!isRankedLeaderboard(leaderboardId)) {
			return errAsync(badRequest('leaderboard id must be a ranked Relic id (4-19)'));
		}

		return cached(`leaderboard:${leaderboardId}`, CACHE_SECONDS, () => this.load(leaderboardId));
	}

	/** Steam ids of every player on the 1v1 and 2v2 ladders, for the sitemap. */
	sitemapSteamIds(): Task<string[]> {
		return cached('sitemap:players', 3600, () =>
			ResultAsync.combine(SITEMAP_BOARDS.map((id) => this.get(id))).map((boards) => [
				...new Set(
					boards
						.flatMap((board) => board.stats)
						.map((stat) => steamIdFromRelicName(stat.profile.name))
						.filter(isValidSteamId)
				)
			])
		);
	}
}
