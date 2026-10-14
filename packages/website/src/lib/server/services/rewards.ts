import { ClientResponseError } from 'pocketbase';
import { okAsync, ResultAsync } from 'neverthrow';
import { parseRewardConditions, rewardImageUrl } from '@company-of-heroes/api/rewards';
import { isAccountReward, type RewardCondition } from '@company-of-heroes/ui/reward/metrics';
import type {
	PlayerRewards,
	RewardConditionProgress,
	RewardProgress,
	RewardView
} from '@company-of-heroes/ui/reward/types';
import { cached, uncache } from '../cache';
import {
	profileFromPersonalStat,
	type LeaderboardStat,
	type RelicPersonalStat
} from '../domain/relic-matches';
import { steamIdsOf } from '../domain/users';
import { all, fromPb, sequence, type Task } from '../result';
import { Service } from './service';

/** Users per job run: each evaluation makes one query per distinct metric. */
const BATCH = 10;
const CACHE_SECONDS = 60;

type RewardRow = {
	id: string;
	collectionId: string;
	collectionName: string;
	title: string;
	description: string;
	image: string;
	ribbon: string;
	conditions: unknown;
	secret: boolean;
	sort: number;
	updated: string;
};

type Reward = RewardRow & { parsed: RewardCondition[] };

type Owner = {
	id: string;
	steamIds: string[];
	reputation: number;
	hasAvatar: boolean;
	created: string;
};

type OwnerRow = {
	id: string;
	steamIds?: unknown;
	reputation?: number;
	avatar?: string;
	created?: string;
};

type Unlock = { reward: string; unlockedAt: string };

type Checked = { reward: Reward; created: boolean; seenBefore: boolean };

type Metric = (condition: RewardCondition) => Task<number>;

/** Fetched at most once per evaluation, however many conditions use it. */
type Shared = { ladder: () => Task<LeaderboardStat[]> };

const OWNER_FIELDS = 'id,steamIds,reputation,avatar,created';
const DAY_MS = 24 * 60 * 60 * 1000;

function toOwner(row: OwnerRow): Owner {
	return {
		id: row.id,
		steamIds: steamIdsOf(row),
		reputation: Number(row.reputation) || 0,
		hasAvatar: Boolean(row.avatar),
		created: row.created ?? ''
	};
}

/** Relic automatch ladders 4–19: four per mode (1v1 to 4v4), in race order US, Wehrmacht, British, Panzer Elite. */
function automatchLadder(leaderboardId: number): { raceId: number; matchtypeId: number } | null {
	if (leaderboardId < 4 || leaderboardId > 19) {
		return null;
	}

	return { raceId: (leaderboardId - 4) % 4, matchtypeId: Math.floor((leaderboardId - 4) / 4) + 1 };
}

/** PocketBase's stored date format, so it compares as a string. */
function pbDate(date: Date): string {
	return date.toISOString().replace('T', ' ');
}

function longestWinStreak(rows: { outcome: number }[]): number {
	let best = 0;
	let current = 0;
	for (const row of rows) {
		current = row.outcome === 1 ? current + 1 : 0;
		best = Math.max(best, current);
	}
	return best;
}

function hasLinks(raw: unknown): boolean {
	if (Array.isArray(raw)) {
		return raw.length > 0;
	}

	if (typeof raw === 'string') {
		try {
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed) && parsed.length > 0;
		} catch {
			return false;
		}
	}

	return false;
}

/** Account rewards only show on the main Steam ID (the first on the account); the others hide them. */
function shownOn(owner: Owner, steamId: string): (reward: Reward) => boolean {
	const main = owner.steamIds[0] === steamId;
	return (reward) => main || !isAccountReward(reward.parsed);
}

/** The owner limited to one Steam ID: match metrics count that ID, account metrics stay shared. */
function forSteamId(owner: Owner, steamId: string): Owner {
	return { ...owner, steamIds: [steamId] };
}

/**
 * Steam-style rewards. Admins define them (`rewards`); unlocks are stored once per
 * Steam ID (`steam_rewards`) and never taken back. Match metrics count that Steam ID
 * only; account metrics (comments, reputation, streaming, …) count for every Steam ID
 * on the account. Progress is computed on request. Events only mark a user as due
 * (`users.rewardsCheckedAt` cleared); the `rewards-evaluate` job unlocks all of the
 * user's Steam IDs and notifies. Editing a reward makes everyone due. Account rewards
 * unlock on every Steam ID but only show on the main one, so changing it keeps them.
 */
export class RewardsService extends Service {
	private get unlocks() {
		return this.pb.collection('steam_rewards');
	}

	/** Enabled rewards with valid conditions. */
	private catalog(): Task<Reward[]> {
		return cached('rewards:catalog', CACHE_SECONDS, () =>
			fromPb(
				this.pb.collection('rewards').getFullList<RewardRow>({
					filter: 'enabled = true',
					sort: 'sort,title',
					fields:
						'id,collectionId,collectionName,title,description,image,ribbon,conditions,secret,sort,updated'
				}),
				'Could not load rewards'
			)
		).map((rows) =>
			rows.flatMap((row) => {
				const parsed = parseRewardConditions(row.conditions);
				if (!parsed) {
					console.warn('[rewards] invalid conditions, skipped', row.id);
					return [];
				}

				return [{ ...row, parsed }];
			})
		);
	}

	/** Newest edit of any reward: users checked before it are due again. */
	private catalogVersion(): Task<string> {
		return fromPb(
			this.pb.collection('rewards').getList<{ updated: string }>(1, 1, {
				sort: '-updated',
				fields: 'updated',
				skipTotal: true
			}),
			'Could not load rewards'
		).map((page) => page.items[0]?.updated ?? '');
	}

	private owner(userId: string): Task<Owner> {
		return fromPb(
			this.pb.collection('users').getOne<OwnerRow>(userId, { fields: OWNER_FIELDS }),
			'User not found'
		).map(toOwner);
	}

	/** The account a Steam id belongs to, or null when nobody linked it. */
	private ownerOf(steamId: string): Task<Owner | null> {
		return fromPb(
			this.pb.collection('users').getList<OwnerRow>(1, 1, {
				filter: this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` }),
				sort: '-lastLogin',
				fields: OWNER_FIELDS,
				skipTotal: true
			}),
			'Could not load users'
		).map((page) => (page.items[0] ? toOwner(page.items[0]) : null));
	}

	private unlocked(steamId: string): Task<Unlock[]> {
		return fromPb(
			this.unlocks.getFullList<Unlock>({
				filter: this.pb.filter('steamId = {:steamId}', { steamId }),
				fields: 'reward,unlockedAt'
			}),
			'Could not load rewards'
		);
	}

	/**
	 * Unlocks from before rewards were per Steam ID. Only read so a Steam ID that earns
	 * one again keeps its original date and the user is not notified twice.
	 */
	private legacyUnlocks(userId: string): Task<Map<string, string>> {
		return fromPb(
			this.pb.collection('user_rewards').getFullList<Unlock>({
				filter: this.pb.filter('user = {:userId}', { userId }),
				fields: 'reward,unlockedAt'
			}),
			'Could not load rewards'
		).map((rows) => new Map(rows.map((row) => [row.reward, row.unlockedAt])));
	}

	private count(collection: string, filter: string): Task<number> {
		return fromPb(
			this.pb.collection(collection).getList(1, 1, { filter, fields: 'id' }),
			'Could not count'
		).map((page) => page.totalItems);
	}

	/** The owner's finished, counted match rows (same base as performance stats) plus the condition's filters. */
	private matchFilter(owner: Owner, condition: RewardCondition, extra: string[] = []): string {
		const { raceId, matchtypeId, ranked, map, minMinutes, maxMinutes, pro, minAvgElo } =
			condition.filter ?? {};
		const parts = [
			`(${owner.steamIds.map((steamId) => this.pb.filter('steam_id = {:steamId}', { steamId })).join(' || ')})`,
			'counts = true && session_id > 0 && (outcome = 0 || outcome = 1)',
			...extra,
			raceId !== undefined ? this.pb.filter('race_id = {:raceId}', { raceId }) : '',
			matchtypeId !== undefined
				? this.pb.filter('matchtype_id = {:matchtypeId}', { matchtypeId })
				: '',
			ranked !== undefined ? `lobby.isRanked = ${ranked}` : '',
			map ? this.pb.filter('map = {:map}', { map }) : '',
			minMinutes !== undefined
				? this.pb.filter('lobby.durationSeconds >= {:seconds}', { seconds: minMinutes * 60 })
				: '',
			maxMinutes !== undefined
				? this.pb.filter('lobby.durationSeconds > 0 && lobby.durationSeconds <= {:seconds}', {
						seconds: maxMinutes * 60
					})
				: '',
			pro ? 'lobby.isPro = true' : '',
			minAvgElo !== undefined ? this.pb.filter('lobby.avgElo >= {:minAvgElo}', { minAvgElo }) : ''
		];
		return parts.filter(Boolean).join(' && ');
	}

	private matchCount(owner: Owner, condition: RewardCondition, extra: string[] = []): Task<number> {
		if (owner.steamIds.length === 0) {
			return okAsync(0);
		}

		return this.count('lobby_player_index', this.matchFilter(owner, condition, extra));
	}

	/** Longest run of wins, in match order (Relic session ids only go up). */
	private winStreak(owner: Owner, condition: RewardCondition): Task<number> {
		if (owner.steamIds.length === 0) {
			return okAsync(0);
		}

		return fromPb(
			this.pb.collection('lobby_player_index').getFullList<{ outcome: number }>({
				filter: this.matchFilter(owner, condition),
				sort: 'session_id',
				fields: 'outcome',
				batch: 1000
			}),
			'Could not load matches'
		).map(longestWinStreak);
	}

	/** Highest current rating over the owner's Steam ids, optionally for one mode and/or faction. */
	private eloReached(owner: Owner, condition: RewardCondition): Task<number> {
		if (owner.steamIds.length === 0) {
			return okAsync(0);
		}

		const { raceId, matchtypeId } = condition.filter ?? {};
		return fromPb(
			this.pb.collection('player_ratings').getFullList<{ elo: unknown }>({
				filter: owner.steamIds
					.map((steamId) => this.pb.filter('steamId = {:steamId}', { steamId }))
					.join(' || '),
				fields: 'elo'
			}),
			'Could not load ratings'
		).map((rows) =>
			rows.reduce((best, row) => {
				const modes = (row.elo && typeof row.elo === 'object' ? row.elo : {}) as Record<
					string,
					Record<string, { rating?: number }>
				>;
				for (const [mode, races] of Object.entries(modes)) {
					if (mode === '14' || (matchtypeId !== undefined && Number(mode) !== matchtypeId)) {
						continue;
					}

					for (const [race, slot] of Object.entries(races ?? {})) {
						if (raceId !== undefined && Number(race) !== raceId) {
							continue;
						}

						best = Math.max(best, Number(slot?.rating) || 0);
					}
				}
				return best;
			}, 0)
		);
	}

	/** Relic ladder stats of every Steam ID; Relic being unreachable counts as none. */
	private ladderStats(owner: Owner): Task<LeaderboardStat[]> {
		return all(
			owner.steamIds.map((steamId) =>
				this.relic
					.get<RelicPersonalStat>(
						`/community/leaderboard/getpersonalstat?title=coh1&profile_names=${encodeURIComponent(JSON.stringify([`/steam/${steamId}`]))}`
					)
					.map(
						(data) =>
							profileFromPersonalStat(data, (member) => member.name === `/steam/${steamId}`)
								?.leaderboardStats ?? []
					)
					.orElse((error) => {
						console.warn('[rewards] relic rank failed', steamId, error);
						return okAsync([]);
					})
			)
		).map((perSteamId) => perSteamId.flat());
	}

	/**
	 * Highest Relic ladder rank (1–20) on the automatch ladders, optionally for one faction
	 * and/or mode. Uses the highest rank ever reached, so a later drop does not matter.
	 * Relic being unreachable counts as 0, so the other rewards still evaluate.
	 */
	private rankReached(condition: RewardCondition, shared: Shared): Task<number> {
		const { raceId, matchtypeId } = condition.filter ?? {};
		return shared.ladder().map((stats) =>
			stats.reduce((best, stat) => {
				const ladder = automatchLadder(stat.leaderboard_id);
				if (
					!ladder ||
					(raceId !== undefined && ladder.raceId !== raceId) ||
					(matchtypeId !== undefined && ladder.matchtypeId !== matchtypeId)
				) {
					return best;
				}

				const reached = Math.max(
					Number((stat as { highestranklevel?: number }).highestranklevel) || 0,
					Number(stat.ranklevel) || 0
				);
				return Math.max(best, reached);
			}, 0)
		);
	}

	private hoursPlayed(owner: Owner): Task<number> {
		if (owner.steamIds.length === 0) {
			return okAsync(0);
		}

		return fromPb(
			this.pb.collection('player_play_time').getFullList<{ seconds: number }>({
				filter: owner.steamIds
					.map((steamId) => this.pb.filter('id = {:steamId}', { steamId }))
					.join(' || '),
				fields: 'seconds'
			}),
			'Could not load play time'
		).map((rows) =>
			Math.floor(rows.reduce((sum, row) => sum + (Number(row.seconds) || 0), 0) / 3600)
		);
	}

	private votesCast(owner: Owner): Task<number> {
		const filter = this.pb.filter('user = {:userId} && value > 0', { userId: owner.id });
		return all(
			[
				'player_likes',
				'lobby_likes',
				'replay_likes',
				'lobby_comment_likes',
				'replay_comment_likes'
			].map((collection) => this.count(collection, filter))
		).map((counts) => counts.reduce((sum, count) => sum + count, 0));
	}

	/** Avatar, plus a public profile with bio, background and at least one link. */
	private profileComplete(owner: Owner): Task<number> {
		if (!owner.hasAvatar) {
			return okAsync(0);
		}

		return fromPb(
			this.pb
				.collection('player_customizations')
				.getFullList<{ bio: string; background: string; links: unknown }>({
					filter: this.pb.filter('user = {:userId}', { userId: owner.id }),
					fields: 'bio,background,links'
				}),
			'Could not load profile'
		).map((rows) =>
			rows.some((row) => row.bio?.trim() && row.background && hasLinks(row.links)) ? 1 : 0
		);
	}

	private hoursStreamed(owner: Owner): Task<number> {
		return fromPb(
			this.pb.collection('streaming_progress').getFullList<{ streamedMs: number }>({
				filter: this.pb.filter('user = {:userId}', { userId: owner.id }),
				fields: 'streamedMs'
			}),
			'Could not load streaming progress'
		).map((rows) =>
			Math.floor(rows.reduce((sum, row) => sum + (Number(row.streamedMs) || 0), 0) / 3_600_000)
		);
	}

	/** Matches with at least one fair play capture. */
	private fairPlayMatches(owner: Owner): Task<number> {
		return fromPb(
			this.pb.collection('anti_cheat_captures').getFullList<{ session_id: number }>({
				filter: this.pb.filter('user = {:userId}', { userId: owner.id }),
				fields: 'session_id',
				batch: 1000
			}),
			'Could not load fair play checks'
		).map((rows) => new Set(rows.map((row) => row.session_id).filter(Boolean)).size);
	}

	private replaySum(owner: Owner, field: 'likeCount' | 'downloadCount'): Task<number> {
		return fromPb(
			this.pb.collection('replays').getFullList<Record<string, number>>({
				filter: this.pb.filter("createdBy = {:userId} && visibility = 'member'", {
					userId: owner.id
				}),
				fields: field,
				batch: 1000
			}),
			'Could not load replays'
		).map((rows) => rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0));
	}

	private receivedVotes(owner: Owner, trigger: string): Task<number> {
		return this.count(
			'user_reputation',
			this.pb.filter('user = {:userId} && type.trigger = {:trigger}', { userId: owner.id, trigger })
		);
	}

	private measure(owner: Owner, condition: RewardCondition, shared: Shared): Task<number> {
		const own = this.pb.filter('user = {:userId} && deleted = false', { userId: owner.id });
		const replies = `${own} && parent != ""`;
		switch (condition.metric) {
			case 'matches_played':
				return this.matchCount(owner, condition);
			case 'wins':
				return this.matchCount(owner, condition, ['outcome = 1']);
			case 'upset_wins':
				// In 1v1 the lobby average above your own pre-match rating means the opponent was higher.
				return this.matchCount(owner, condition, [
					'matchtype_id = 1 && outcome = 1 && elo > 0 && lobby.avgElo > elo'
				]);
			case 'win_streak':
				return this.winStreak(owner, condition);
			case 'elo_reached':
				return this.eloReached(owner, condition);
			case 'rank_reached':
				return this.rankReached(condition, shared);
			case 'hours_played':
				return this.hoursPlayed(owner);
			case 'matches_recorded':
				return this.count(
					'lobbies',
					this.pb.filter('user = {:userId} && hasFailed = false', { userId: owner.id })
				);
			case 'replies_created':
				return all([
					this.count('lobby_comments', replies),
					this.count('replay_comments', replies)
				]).map(([lobbies, replays]) => lobbies + replays);
			case 'votes_cast':
				return this.votesCast(owner);
			case 'profile_complete':
				return this.profileComplete(owner);
			case 'account_age_days':
				return okAsync(
					owner.created
						? Math.floor((Date.now() - Date.parse(owner.created.replace(' ', 'T'))) / DAY_MS)
						: 0
				);
			case 'hours_streamed':
				return this.hoursStreamed(owner);
			case 'fair_play_matches':
				return this.fairPlayMatches(owner);
			case 'overlay_published':
				return this.count(
					'user_overlays',
					this.pb.filter('user = {:userId}', { userId: owner.id })
				).map((count) => (count > 0 ? 1 : 0));
			case 'reputation':
				return okAsync(owner.reputation);
			case 'comments_created':
				return all([this.count('lobby_comments', own), this.count('replay_comments', own)]).map(
					([lobbies, replays]) => lobbies + replays
				);
			case 'replays_uploaded':
				return this.count(
					'replays',
					this.pb.filter("createdBy = {:userId} && visibility = 'member'", { userId: owner.id })
				);
			case 'replay_likes_received':
				return this.replaySum(owner, 'likeCount');
			case 'replay_downloads_received':
				return this.replaySum(owner, 'downloadCount');
			case 'replays_downloaded':
				// Signed-in match replay downloads, once per replay (anonymous downloads have no user).
				return this.count(
					'lobby_downloads',
					this.pb.filter('user = {:userId}', { userId: owner.id })
				);
			case 'comment_upvotes_received':
				return this.receivedVotes(owner, 'comment_received_upvote');
			case 'player_upvotes_received':
				return this.receivedVotes(owner, 'player_received_upvote');
			default:
				return okAsync(0);
		}
	}

	/** Measures each distinct metric + filter once per owner. */
	private metrics(owner: Owner): Metric {
		const memo = new Map<string, Task<number>>();
		let ladder: Task<LeaderboardStat[]> | undefined;
		const shared: Shared = { ladder: () => (ladder ??= this.ladderStats(owner)) };
		return (condition) => {
			const key = `${condition.metric}:${JSON.stringify(condition.filter ?? {})}`;
			let task = memo.get(key);
			if (!task) {
				task = this.measure(owner, condition, shared);
				memo.set(key, task);
			}

			return task;
		};
	}

	private progress(reward: Reward, metric: Metric): Task<RewardProgress> {
		return all(
			reward.parsed.map((condition) =>
				metric(condition).map((value): RewardConditionProgress => ({ ...condition, value }))
			)
		).map((conditions) => ({
			overall: Math.min(
				...conditions.map((condition) => Math.min(1, condition.value / condition.threshold))
			),
			conditions
		}));
	}

	private view(reward: Reward, unlockedAt: string | null, progress?: RewardProgress): RewardView {
		const hidden = reward.secret && !unlockedAt;
		return {
			id: reward.id,
			title: hidden ? '' : reward.title,
			description: hidden ? '' : reward.description,
			imageUrl: hidden ? null : rewardImageUrl(this.pb, reward),
			ribbon: hidden ? null : reward.ribbon || null,
			conditions: hidden ? [] : reward.parsed,
			secret: reward.secret,
			sort: reward.sort,
			unlockedAt,
			...(progress
				? { progress: hidden ? { overall: progress.overall, conditions: [] } : progress }
				: {})
		};
	}

	/** Everything the owner sees for one Steam ID: unlocked rewards, and locked ones with progress. */
	private ownView(owner: Owner, steamId: string): Task<PlayerRewards> {
		return ResultAsync.combine([this.catalog(), this.unlocked(steamId)]).andThen(
			([catalog, unlocks]) => {
				const when = new Map(unlocks.map((unlock) => [unlock.reward, unlock.unlockedAt]));
				const metric = this.metrics(forSteamId(owner, steamId));
				return all(
					catalog.filter(shownOn(owner, steamId)).map((reward) => {
						const unlockedAt = when.get(reward.id) ?? null;
						return unlockedAt
							? okAsync(this.view(reward, unlockedAt))
							: this.progress(reward, metric).map((progress) => this.view(reward, null, progress));
					})
				).map((rewards) => ({ owned: true, linked: true, rewards }));
			}
		);
	}

	private publicView(owner: Owner, steamId: string): Task<PlayerRewards> {
		return ResultAsync.combine([this.catalog(), this.unlocked(steamId)]).map(
			([catalog, unlocks]) => {
				const when = new Map(unlocks.map((unlock) => [unlock.reward, unlock.unlockedAt]));
				return {
					owned: false,
					linked: true,
					rewards: catalog
						.filter((reward) => when.has(reward.id))
						.filter(shownOn(owner, steamId))
						.map((reward) => this.view(reward, when.get(reward.id) ?? null))
				};
			}
		);
	}

	/** Every enabled reward as the wiki shows it; secret ones stay blank. */
	catalogView(): Task<RewardView[]> {
		return this.catalog().map((catalog) => catalog.map((reward) => this.view(reward, null)));
	}

	/** A player's unlocked rewards; the owner also gets locked ones with progress. */
	forPlayer(steamId: string, viewerId: string | null): Task<PlayerRewards> {
		return this.ownerOf(steamId).andThen((owner) => {
			if (!owner) {
				return okAsync<PlayerRewards>({ owned: false, linked: false, rewards: [] });
			}

			if (viewerId === owner.id) {
				return this.ownView(owner, steamId);
			}

			return cached(`rewards:player:${steamId}`, CACHE_SECONDS, () =>
				this.publicView(owner, steamId)
			);
		});
	}

	/** The signed-in user's own rewards, for the main (first) Steam ID on the account. */
	forUser(userId: string): Task<PlayerRewards> {
		return this.owner(userId).andThen((owner) => {
			const [steamId] = owner.steamIds;
			return steamId
				? this.ownView(owner, steamId)
				: okAsync<PlayerRewards>({ owned: true, linked: false, rewards: [] });
		});
	}

	/** Queues users for the next `rewards-evaluate` run (skips ones already queued). */
	markDirty(users: { id: string; rewardsCheckedAt?: string }[]): Task<void> {
		return sequence(
			users.filter((user) => user.id && user.rewardsCheckedAt !== ''),
			(user) =>
				fromPb(
					this.pb.collection('users').update(user.id, { rewardsCheckedAt: null }),
					'Could not queue rewards'
				)
		).map(() => undefined);
	}

	/** Creates the unlock; false when another run already did. */
	private unlock(steamId: string, rewardId: string, unlockedAt: string): Task<boolean> {
		return fromPb(
			this.unlocks
				.create({ steamId, reward: rewardId, unlockedAt })
				.then(() => true)
				.catch((error) => {
					// The unique (steamId, reward) index makes a repeat unlock a no-op.
					if (error instanceof ClientResponseError && error.status === 400) {
						return false;
					}

					throw error;
				}),
			'Could not unlock reward'
		);
	}

	/** One notification per run, so a first (retroactive) evaluation does not flood the user. */
	private notify(userId: string, rewards: Reward[]): Task<void> {
		if (rewards.length === 0) {
			return okAsync(undefined);
		}

		const [first] = rewards;
		const notification =
			rewards.length === 1
				? { title: `Reward unlocked: ${first.title}`, body: first.description || first.title }
				: {
						title: `You unlocked ${rewards.length} rewards`,
						body: rewards.map((reward) => reward.title).join(', ')
					};
		return fromPb(
			this.pb
				.collection('notifications')
				.create({ ...notification, targetAll: false, recipients: [userId] }),
			'Could not notify'
		).map(() => undefined);
	}

	/** Unlocks every reward one Steam ID now qualifies for. */
	private evaluateSteamId(
		owner: Owner,
		steamId: string,
		catalog: Reward[],
		legacy: Map<string, string>
	): Task<Checked[]> {
		return this.unlocked(steamId).andThen((unlocks) => {
			const have = new Set(unlocks.map((unlock) => unlock.reward));
			const metric = this.metrics(forSteamId(owner, steamId));
			return all(
				catalog
					.filter((reward) => !have.has(reward.id))
					.map((reward) => this.progress(reward, metric).map((progress) => ({ reward, progress })))
			)
				.andThen((checked) =>
					sequence(
						checked.filter(({ progress }) => progress.overall >= 1),
						({ reward }) => {
							const earlier = legacy.get(reward.id);
							return this.unlock(steamId, reward.id, earlier ?? new Date().toISOString()).map(
								(created): Checked => ({ reward, created, seenBefore: earlier !== undefined })
							);
						}
					)
				)
				.andThen((results) =>
					results.some(({ created }) => created)
						? uncache(`rewards:player:${steamId}`).map(() => results)
						: okAsync(results)
				);
		});
	}

	/** Unlocks every reward the user's Steam IDs now qualify for; returns how many were new. */
	evaluate(userId: string): Task<number> {
		return ResultAsync.combine([
			this.catalog(),
			this.owner(userId),
			this.legacyUnlocks(userId)
		]).andThen(([catalog, owner, legacy]) =>
			sequence(owner.steamIds, (steamId) => this.evaluateSteamId(owner, steamId, catalog, legacy))
				.andThen((perSteamId) => {
					// Notify each reward once, even when several Steam IDs unlocked it in this run.
					const fresh = [
						...new Map(
							perSteamId
								.flat()
								.filter(({ created, seenBefore }) => created && !seenBefore)
								.map(({ reward }) => [reward.id, reward])
						).values()
					];
					return this.notify(userId, fresh).map(() => fresh.length);
				})
				.andThen((fresh) =>
					// Auto labels on the highest rank ever; the ladders only show the current one.
					this.services.labelAuto
						.grantForSteamIds(owner.steamIds)
						.orElse((error) => {
							console.warn('[rewards] auto labels failed', userId, error);
							return okAsync(0);
						})
						.map(() => fresh)
				)
				.andThen((fresh) =>
					fromPb(
						this.pb
							.collection('users')
							.update(userId, { rewardsCheckedAt: new Date().toISOString() }),
						'Could not save rewards check'
					).map(() => fresh)
				)
		);
	}

	/**
	 * Job: evaluates users that are queued, never checked, checked before the last reward
	 * edit, or not checked for a day — oldest first. The daily re-check covers time-based
	 * metrics (account age) and data written without a hook (fair play captures, profile
	 * edits). Also the retroactive backfill for existing users.
	 */
	evaluateDue(): Task<{ processed: number; more: boolean }> {
		return ResultAsync.combine([this.catalog(), this.catalogVersion()]).andThen(
			([catalog, version]) => {
				if (catalog.length === 0) {
					return okAsync({ processed: 0, more: false });
				}

				const dayAgo = pbDate(new Date(Date.now() - DAY_MS));
				const staleBefore = version > dayAgo ? version : dayAgo;
				return fromPb(
					this.pb.collection('users').getList<{ id: string }>(1, BATCH, {
						filter: this.pb.filter('rewardsCheckedAt = "" || rewardsCheckedAt < {:staleBefore}', {
							staleBefore
						}),
						sort: 'rewardsCheckedAt',
						fields: 'id',
						skipTotal: true
					}),
					'Could not load users'
				).andThen((page) =>
					sequence(page.items, (user) =>
						this.evaluate(user.id).orElse((error) => {
							// Mark it checked anyway, or one broken user would block the queue; its next event retries.
							console.warn('[rewards] evaluate failed', user.id, error);
							return fromPb(
								this.pb
									.collection('users')
									.update(user.id, { rewardsCheckedAt: new Date().toISOString() }),
								'Could not save rewards check'
							).map(() => 0);
						})
					).map(() => ({ processed: page.items.length, more: page.items.length === BATCH }))
				);
			}
		);
	}
}
