import { ClientResponseError } from 'pocketbase';
import { okAsync, ResultAsync } from 'neverthrow';
import { parseRewardConditions, rewardImageUrl } from '@company-of-heroes/api/rewards';
import type { RewardCondition } from '@company-of-heroes/ui/reward/metrics';
import type {
	PlayerRewards,
	RewardConditionProgress,
	RewardProgress,
	RewardView
} from '@company-of-heroes/ui/reward/types';
import { cached, uncache } from '../cache';
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

type Metric = (condition: RewardCondition) => Task<number>;

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

/**
 * Steam-style rewards. Admins define them (`rewards`); unlocks are stored once per
 * user (`user_rewards`) and never taken back. Progress is computed on request.
 * Events only mark a user as due (`users.rewardsCheckedAt` cleared); the
 * `rewards-evaluate` job unlocks and notifies. Editing a reward makes everyone due.
 */
export class RewardsService extends Service {
	private get unlocks() {
		return this.pb.collection('user_rewards');
	}

	/** Enabled rewards with valid conditions. */
	private catalog(): Task<Reward[]> {
		return cached('rewards:catalog', CACHE_SECONDS, () =>
			fromPb(
				this.pb.collection('rewards').getFullList<RewardRow>({
					filter: 'enabled = true',
					sort: 'sort,title',
					fields:
						'id,collectionId,collectionName,title,description,image,conditions,secret,sort,updated'
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

	private unlocked(userId: string): Task<Unlock[]> {
		return fromPb(
			this.unlocks.getFullList<Unlock>({
				filter: this.pb.filter('user = {:userId}', { userId }),
				fields: 'reward,unlockedAt'
			}),
			'Could not load rewards'
		);
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
			this.pb.collection('streaming_progress').getList<{ streamedMs: number }>(1, 1, {
				filter: this.pb.filter('user = {:userId}', { userId: owner.id }),
				fields: 'streamedMs',
				skipTotal: true
			}),
			'Could not load streaming progress'
		).map((page) => Math.floor((Number(page.items[0]?.streamedMs) || 0) / 3_600_000));
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

	private measure(owner: Owner, condition: RewardCondition): Task<number> {
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
		return (condition) => {
			const key = `${condition.metric}:${JSON.stringify(condition.filter ?? {})}`;
			let task = memo.get(key);
			if (!task) {
				task = this.measure(owner, condition);
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
			secret: reward.secret,
			sort: reward.sort,
			unlockedAt,
			...(progress
				? { progress: hidden ? { overall: progress.overall, conditions: [] } : progress }
				: {})
		};
	}

	/** Everything the owner sees: unlocked rewards, and locked ones with progress. */
	private ownView(owner: Owner): Task<PlayerRewards> {
		return ResultAsync.combine([this.catalog(), this.unlocked(owner.id)]).andThen(
			([catalog, unlocks]) => {
				const when = new Map(unlocks.map((unlock) => [unlock.reward, unlock.unlockedAt]));
				const metric = this.metrics(owner);
				return all(
					catalog.map((reward) => {
						const unlockedAt = when.get(reward.id) ?? null;
						return unlockedAt
							? okAsync(this.view(reward, unlockedAt))
							: this.progress(reward, metric).map((progress) => this.view(reward, null, progress));
					})
				).map((rewards) => ({ owned: true, linked: true, rewards }));
			}
		);
	}

	private publicView(owner: Owner): Task<PlayerRewards> {
		return ResultAsync.combine([this.catalog(), this.unlocked(owner.id)]).map(
			([catalog, unlocks]) => {
				const when = new Map(unlocks.map((unlock) => [unlock.reward, unlock.unlockedAt]));
				return {
					owned: false,
					linked: true,
					rewards: catalog
						.filter((reward) => when.has(reward.id))
						.map((reward) => this.view(reward, when.get(reward.id) ?? null))
				};
			}
		);
	}

	/** A player's unlocked rewards; the owner also gets locked ones with progress. */
	forPlayer(steamId: string, viewerId: string | null): Task<PlayerRewards> {
		return this.ownerOf(steamId).andThen((owner) => {
			if (!owner) {
				return okAsync<PlayerRewards>({ owned: false, linked: false, rewards: [] });
			}

			if (viewerId === owner.id) {
				return this.ownView(owner);
			}

			return cached(`rewards:player:${steamId}`, CACHE_SECONDS, () => this.publicView(owner));
		});
	}

	/** The signed-in user's own rewards. */
	forUser(userId: string): Task<PlayerRewards> {
		return this.owner(userId).andThen((owner) => this.ownView(owner));
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
	private unlock(userId: string, rewardId: string): Task<boolean> {
		return fromPb(
			this.unlocks
				.create({ user: userId, reward: rewardId, unlockedAt: new Date().toISOString() })
				.then(() => true)
				.catch((error) => {
					// The unique (user, reward) index makes a repeat unlock a no-op.
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

	/** Unlocks every reward the user now qualifies for; returns how many were new. */
	evaluate(userId: string): Task<number> {
		return ResultAsync.combine([this.catalog(), this.owner(userId), this.unlocked(userId)]).andThen(
			([catalog, owner, unlocks]) => {
				const have = new Set(unlocks.map((unlock) => unlock.reward));
				const metric = this.metrics(owner);
				return all(
					catalog
						.filter((reward) => !have.has(reward.id))
						.map((reward) =>
							this.progress(reward, metric).map((progress) => ({ reward, progress }))
						)
				)
					.andThen((checked) =>
						sequence(
							checked.filter(({ progress }) => progress.overall >= 1),
							({ reward }) => this.unlock(userId, reward.id).map((created) => ({ reward, created }))
						)
					)
					.andThen((results) => {
						const fresh = results.filter(({ created }) => created).map(({ reward }) => reward);
						return this.notify(userId, fresh)
							.andThen(() =>
								fresh.length > 0
									? sequence(owner.steamIds, (steamId) => uncache(`rewards:player:${steamId}`))
									: okAsync([])
							)
							.map(() => fresh.length);
					})
					.andThen((fresh) =>
						fromPb(
							this.pb
								.collection('users')
								.update(userId, { rewardsCheckedAt: new Date().toISOString() }),
							'Could not save rewards check'
						).map(() => fresh)
					);
			}
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
