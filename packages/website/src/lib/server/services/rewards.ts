import { errAsync, okAsync, ResultAsync } from 'neverthrow';
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
import { all, chunk, fromPb, sequence, type Task } from '../result';
import type { ConditionalLabel } from './label-auto';
import { Service } from './service';

/** Users per job run: each evaluation makes one query per distinct metric. */
const BATCH = 5;
/** A run stops starting new users after this, so it stays clear of the worker limits. */
const BUDGET_MS = 20_000;
/** A user whose evaluation failed is retried after this, behind the users already due (`retryAt`). */
const RETRY_MS = 15 * 60 * 1000;
const CACHE_SECONDS = 60;
/** PocketBase's batch API limit (`settings.batch.maxRequests`). */
const PB_BATCH = 50;

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
	/** Steam IDs another account lists too: they get no account rewards or labels. */
	shared: Set<string>;
};

type OwnerRow = {
	id: string;
	steamIds?: unknown;
	reputation?: number;
	avatar?: string;
	created?: string;
};

type Unlock = { reward: string; unlockedAt: string };

type DueUser = { id: string; rewardsCheckedAt: string };

/** What one job run evaluates against, loaded once and uncached. */
type Catalog = { rewards: Reward[]; labels: ConditionalLabel[] };

type Metric = (condition: RewardCondition) => Task<number>;

/** A counted `lobby_player_index` row; duplicate lobbies of one Relic match share `session_id`. */
type SessionRow = { session_id: number; lobby: string };

type StreakRow = { session_id: number; outcome: number | null; profile_id: number };

/** Fetched at most once per evaluation, however many conditions use it. */
type Shared = {
	ladder: () => Task<LeaderboardStat[]>;
	/** Sessions the owner has more than one counted row in; usually none. */
	duplicates: () => Task<number[]>;
};

const OWNER_FIELDS = 'id,steamIds,reputation,avatar,created';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Lobby ids per filter, so the query string stays well under URL limits. */
const ID_CHUNK = 50;

function toOwner(row: OwnerRow): Owner {
	return {
		id: row.id,
		steamIds: steamIdsOf(row),
		reputation: Number(row.reputation) || 0,
		hasAvatar: Boolean(row.avatar),
		created: row.created ?? '',
		shared: new Set()
	};
}

/** Rows beyond the first of each session: a Relic match recorded in several lobbies. */
function extraRows(rows: SessionRow[]): number {
	return rows.length - new Set(rows.map((row) => row.session_id)).size;
}

/** The lobbies of each session that has more than one. */
function duplicateLobbies(rows: SessionRow[]): { session: number; lobbies: string[] }[] {
	const bySession = new Map<number, Set<string>>();
	for (const row of rows) {
		bySession.set(row.session_id, (bySession.get(row.session_id) ?? new Set()).add(row.lobby));
	}

	return [...bySession]
		.filter(([, lobbies]) => lobbies.size > 1)
		.map(([session, lobbies]) => ({ session, lobbies: [...lobbies] }));
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

/**
 * `rewardsCheckedAt` after a failed evaluation: due again after `RETRY_MS`, sorted with the
 * users last checked a day ago, so behind never-checked and stale ones. Never before the
 * catalog `version` the run used: the due query treats anything older as stale, so after a
 * reward edit a failing user would be due (and first) on every run and fill each batch.
 * Within a day of an edit it therefore waits for the daily re-check.
 */
function retryAt(version: string): string {
	const retry = pbDate(new Date(Date.now() - DAY_MS + RETRY_MS));
	return version > retry ? version : retry;
}

/** Longest run of wins over the sessions in match order (Relic session ids only go up). */
function longestWinStreak(won: Map<number, boolean>): number {
	let best = 0;
	let current = 0;
	for (const session of [...won.keys()].sort((a, b) => a - b)) {
		current = won.get(session) ? current + 1 : 0;
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
 * Account rewards only show on the main Steam ID (the first on the account); the others hide
 * them. Account labels are only assigned to the main one, for the same reason. A Steam ID
 * another account lists too shows none: they would be one user's on another's profile.
 */
function shownOn(owner: Owner, steamId: string): (reward: Pick<Reward, 'parsed'>) => boolean {
	const main = owner.steamIds[0] === steamId && !owner.shared.has(steamId);
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
 * unlock on every Steam ID but only show on the main one, so changing it keeps them; a
 * Steam ID another account lists too gets none. Match metrics count each Relic session once.
 * Labels with conditions are evaluated the same way and assigned like a staff label.
 */
export class RewardsService extends Service {
	private get unlocks() {
		return this.pb.collection('steam_rewards');
	}

	private catalogRows(): Task<RewardRow[]> {
		return fromPb(
			this.pb.collection('rewards').getFullList<RewardRow>({
				filter: 'enabled = true',
				sort: 'sort,title',
				fields:
					'id,collectionId,collectionName,title,description,image,ribbon,conditions,secret,sort,updated'
			}),
			'Could not load rewards'
		);
	}

	/**
	 * Enabled rewards with valid conditions. `fresh` skips the cache: the job compares the
	 * catalog with `catalogVersion`, which is never cached either.
	 */
	private catalog({ fresh = false } = {}): Task<Reward[]> {
		return (
			fresh
				? this.catalogRows()
				: cached('rewards:catalog', CACHE_SECONDS, () => this.catalogRows())
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

	/** Newest edit of any reward or conditional label: users checked before it are due again. */
	private catalogVersion(labels: ConditionalLabel[]): Task<string> {
		return fromPb(
			this.pb.collection('rewards').getList<{ updated: string }>(1, 1, {
				sort: '-updated',
				fields: 'updated',
				skipTotal: true
			}),
			'Could not load rewards'
		).map((page) =>
			[page.items[0]?.updated ?? '', ...labels.map((label) => label.updated)].reduce(
				(newest, updated) => (updated > newest ? updated : newest),
				''
			)
		);
	}

	/**
	 * Rewards and conditional labels as they are now. The labels' cache is dropped first,
	 * or users checked within its TTL after a label edit would count as checked against it.
	 */
	private freshCatalog(): Task<Catalog> {
		return ResultAsync.combine([
			this.catalog({ fresh: true }),
			uncache('labels:conditional').andThen(() => this.services.labelAuto.conditionalLabels())
		]).map(([rewards, labels]) => ({ rewards, labels }));
	}

	private owner(userId: string): Task<Owner> {
		return fromPb(
			this.pb.collection('users').getOne<OwnerRow>(userId, { fields: OWNER_FIELDS }),
			'User not found'
		)
			.map(toOwner)
			.andThen((owner) => this.withShared(owner));
	}

	/** Marks the owner's Steam IDs that another account lists too, in one query. */
	private withShared(owner: Owner): Task<Owner> {
		if (owner.steamIds.length === 0) {
			return okAsync(owner);
		}

		const listed = owner.steamIds
			.map((steamId) => this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` }))
			.join(' || ');
		return fromPb(
			this.pb.collection('users').getFullList<{ steamIds?: unknown }>({
				filter: `${this.pb.filter('id != {:userId}', { userId: owner.id })} && (${listed})`,
				fields: 'steamIds'
			}),
			'Could not load users'
		).map((others) => {
			const elsewhere = new Set(others.flatMap(steamIdsOf));
			return { ...owner, shared: new Set(owner.steamIds.filter((id) => elsewhere.has(id))) };
		});
	}

	/** The account a Steam id belongs to (the last to sign in when several list it), or null. */
	private ownerOf(steamId: string): Task<Owner | null> {
		return fromPb(
			this.pb.collection('users').getList<OwnerRow>(1, 2, {
				filter: this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` }),
				sort: '-lastLogin',
				fields: OWNER_FIELDS,
				skipTotal: true
			}),
			'Could not load users'
		).map((page) =>
			page.items[0]
				? {
						...toOwner(page.items[0]),
						shared: new Set(page.items.length > 1 ? [steamId] : [])
					}
				: null
		);
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
	 * Unlocks from before rewards were per Steam ID. The main Steam ID keeps them whatever
	 * its progress; another Steam ID that earns one gets the original date. Neither notifies.
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
		return [
			`(${owner.steamIds.map((steamId) => this.pb.filter('steam_id = {:steamId}', { steamId })).join(' || ')})`,
			'counts = true && session_id > 0 && (outcome = 0 || outcome = 1)',
			...extra,
			...this.conditionFilters(condition)
		].join(' && ');
	}

	/** The condition's own filters on `lobby_player_index`. */
	private conditionFilters(condition: RewardCondition): string[] {
		const { raceId, matchtypeId, ranked, map, minMinutes, maxMinutes, pro, minAvgElo } =
			condition.filter ?? {};
		const parts = [
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
		return parts.filter(Boolean);
	}

	/**
	 * Sessions the owner has more than one counted row in: a Relic match recorded in two
	 * lobbies until the lobby-merge job runs. One query on the `player_duplicate_sessions`
	 * view, which only groups this owner's rows.
	 */
	private duplicateSessions(owner: Owner): Task<number[]> {
		if (owner.steamIds.length === 0) {
			return okAsync([]);
		}

		return fromPb(
			this.pb.collection('player_duplicate_sessions').getFullList<{ session_id: number }>({
				filter: owner.steamIds
					.map((steamId) => this.pb.filter('steam_id = {:steamId}', { steamId }))
					.join(' || '),
				fields: 'session_id'
			}),
			'Could not load matches'
		).map((rows) => [...new Set(rows.map((row) => row.session_id))]);
	}

	/** The owner's counted rows in duplicated sessions that match the filter; no request without any. */
	private duplicateRows(
		owner: Owner,
		condition: RewardCondition,
		shared: Shared,
		extra: string[] = []
	): Task<SessionRow[]> {
		return shared.duplicates().andThen((sessions) =>
			sequence(chunk(sessions, ID_CHUNK), (ids) =>
				fromPb(
					this.pb.collection('lobby_player_index').getFullList<SessionRow>({
						filter: this.matchFilter(owner, condition, [
							`(${ids.map((session) => this.pb.filter('session_id = {:session}', { session })).join(' || ')})`,
							...extra
						]),
						fields: 'session_id,lobby'
					}),
					'Could not load matches'
				)
			).map((pages) => pages.flat())
		);
	}

	/**
	 * Counted matches for the filter, each Relic session once: a count query, minus the extra
	 * rows of duplicated sessions (only loaded when the owner has any).
	 */
	private matchCount(
		owner: Owner,
		condition: RewardCondition,
		shared: Shared,
		extra: string[] = []
	): Task<number> {
		if (owner.steamIds.length === 0) {
			return okAsync(0);
		}

		return ResultAsync.combine([
			this.count('lobby_player_index', this.matchFilter(owner, condition, extra)),
			this.duplicateRows(owner, condition, shared, extra)
		]).map(([rows, duplicates]) => rows - extraRows(duplicates));
	}

	/**
	 * Sessions of finished matches whose result never arrived (Relic lookup failed): no Steam
	 * ID, outcome, faction or mode on the row, so found by profile id. Skirmish (AI) games stay
	 * out; with a faction or mode filter nobody can tell whether the match qualified.
	 */
	private unresolvedSessions(profileIds: number[], condition: RewardCondition): Task<number[]> {
		const { raceId, matchtypeId } = condition.filter ?? {};
		if (profileIds.length === 0 || raceId !== undefined || matchtypeId !== undefined) {
			return okAsync([]);
		}

		return fromPb(
			this.pb.collection('lobby_player_index').getFullList<{ session_id: number }>({
				filter: [
					`(${profileIds.map((profileId) => this.pb.filter('profile_id = {:profileId}', { profileId })).join(' || ')})`,
					"session_id > 0 && lobby.needsResult = true && lobby.hasFailed = true && lobby.title != 'Skirmish'",
					...this.conditionFilters(condition)
				].join(' && '),
				fields: 'session_id',
				batch: 1000
			}),
			'Could not load matches'
		).map((rows) => rows.map((row) => row.session_id));
	}

	/** Longest run of wins; a match without a result breaks it like a loss. */
	private winStreak(owner: Owner, condition: RewardCondition): Task<number> {
		if (owner.steamIds.length === 0) {
			return okAsync(0);
		}

		return fromPb(
			this.pb.collection('lobby_player_index').getFullList<StreakRow>({
				filter: this.matchFilter(owner, condition),
				sort: 'session_id',
				fields: 'session_id,outcome,profile_id',
				batch: 1000
			}),
			'Could not load matches'
		).andThen((rows) => {
			const won = new Map<number, boolean>();
			for (const row of rows) {
				won.set(row.session_id, won.get(row.session_id) === true || row.outcome === 1);
			}

			const profileIds = [...new Set(rows.map((row) => row.profile_id).filter(Boolean))];
			return this.unresolvedSessions(profileIds, condition).map((sessions) => {
				// A duplicate lobby of the session that did get a result decides it.
				for (const session of sessions) {
					if (!won.has(session)) {
						won.set(session, false);
					}
				}

				return longestWinStreak(won);
			});
		});
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

	/**
	 * The `player_play_time` view sums every counted row, so a match recorded in two lobbies
	 * counts twice: the extra lobbies' durations are taken off again (each session keeps its
	 * longest). Only duplicated sessions need their rows and durations loaded.
	 */
	private hoursPlayed(owner: Owner, condition: RewardCondition, shared: Shared): Task<number> {
		if (owner.steamIds.length === 0) {
			return okAsync(0);
		}

		const viewSeconds = fromPb(
			this.pb.collection('player_play_time').getFullList<{ seconds: number }>({
				filter: owner.steamIds
					.map((steamId) => this.pb.filter('id = {:steamId}', { steamId }))
					.join(' || '),
				fields: 'seconds'
			}),
			'Could not load play time'
		).map((rows) => rows.reduce((sum, row) => sum + (Number(row.seconds) || 0), 0));
		return ResultAsync.combine([
			viewSeconds,
			this.duplicateRows(owner, { ...condition, filter: undefined }, shared).andThen((rows) =>
				this.doubleCounted(rows)
			)
		]).map(([seconds, extra]) => Math.floor(Math.max(0, seconds - extra) / 3600));
	}

	/** Seconds the view counts more than once: per duplicated session, all but its longest lobby. */
	private doubleCounted(rows: SessionRow[]): Task<number> {
		const duplicates = duplicateLobbies(rows);
		if (duplicates.length === 0) {
			return okAsync(0);
		}

		return sequence(chunk([...new Set(duplicates.flatMap((d) => d.lobbies))], ID_CHUNK), (ids) =>
			fromPb(
				this.pb.collection('lobbies').getFullList<{ id: string; durationSeconds: number }>({
					filter: ids.map((id) => this.pb.filter('id = {:id}', { id })).join(' || '),
					fields: 'id,durationSeconds'
				}),
				'Could not load matches'
			)
		).map((pages) => {
			const duration = new Map(
				pages.flat().map((lobby) => [lobby.id, Number(lobby.durationSeconds) || 0])
			);
			return duplicates.reduce((sum, { lobbies }) => {
				const seconds = lobbies.map((id) => duration.get(id) ?? 0);
				return sum + seconds.reduce((a, b) => a + b, 0) - Math.max(...seconds);
			}, 0);
		});
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
				return this.matchCount(owner, condition, shared);
			case 'wins':
				return this.matchCount(owner, condition, shared, ['outcome = 1']);
			case 'upset_wins':
				// In 1v1 the lobby average above your own pre-match rating means the opponent was higher.
				return this.matchCount(owner, condition, shared, [
					'matchtype_id = 1 && outcome = 1 && elo > 0 && lobby.avgElo > elo'
				]);
			case 'win_streak':
				return this.winStreak(owner, condition);
			case 'elo_reached':
				return this.eloReached(owner, condition);
			case 'rank_reached':
				return this.rankReached(condition, shared);
			case 'hours_played':
				return this.hoursPlayed(owner, condition, shared);
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
			case 'supporter_active':
			case 'supporter_months':
				// The supporter subscriptions task fills these in.
				return okAsync(0);
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
		let duplicates: Task<number[]> | undefined;
		const shared: Shared = {
			ladder: () => (ladder ??= this.ladderStats(owner)),
			duplicates: () => (duplicates ??= this.duplicateSessions(owner))
		};
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

	/**
	 * One reward's or label's progress; null when a metric failed (a filter PocketBase
	 * rejects, a timeout), so the others still evaluate.
	 */
	private progressOrSkip(
		id: string,
		conditions: RewardCondition[],
		metric: Metric
	): Task<RewardProgress | null> {
		return this.progress(conditions, metric).orElse((error) => {
			console.warn('[rewards] progress failed, skipped', id, error);
			return okAsync(null);
		});
	}

	private progress(conditions: RewardCondition[], metric: Metric): Task<RewardProgress> {
		return all(
			conditions.map((condition) =>
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
							: this.progressOrSkip(reward.id, reward.parsed, metric).map((progress) =>
									this.view(reward, null, progress ?? undefined)
								);
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

	/**
	 * Queues users for the next `rewards-evaluate` run. Always writes: a value the caller
	 * read earlier may be stale, and a run that claimed the user may already have read the
	 * data that just changed.
	 */
	markDirty(users: { id: string }[]): Task<void> {
		return sequence([...new Set(users.map((user) => user.id).filter(Boolean))], (userId) =>
			fromPb(
				this.pb.collection('users').update(userId, { rewardsCheckedAt: null }),
				'Could not queue rewards'
			)
		).map(() => undefined);
	}

	private hasUnlock(steamId: string, rewardId: string): Task<boolean> {
		return fromPb(
			this.unlocks.getList(1, 1, {
				filter: this.pb.filter('steamId = {:steamId} && reward = {:rewardId}', {
					steamId,
					rewardId
				}),
				fields: 'id',
				skipTotal: true
			}),
			'Could not load rewards'
		).map((page) => page.items.length > 0);
	}

	/**
	 * Creates the unlock; false when another run already did. `pendingNotify` unlocks are
	 * announced by `notifyPending`, which retries until it succeeds.
	 */
	private unlock(
		steamId: string,
		rewardId: string,
		unlockedAt: string,
		pendingNotify: boolean
	): Task<boolean> {
		return fromPb(
			this.unlocks.create({ steamId, reward: rewardId, unlockedAt, pendingNotify }),
			'Could not unlock reward'
		)
			.map(() => true)
			.orElse((error) =>
				// The unique (steamId, reward) index rejects a repeat unlock with a 400, as does
				// any other invalid value: only an existing row means "already unlocked".
				error.status === 400
					? this.hasUnlock(steamId, rewardId).andThen((exists) =>
							exists ? okAsync(false) : errAsync(error)
						)
					: errAsync(error)
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

	/** Assigns every conditional label one Steam ID now meets; never taken back. */
	private evaluateLabels(
		owner: Owner,
		steamId: string,
		labels: ConditionalLabel[],
		metric: Metric
	): Task<number> {
		const candidates = labels.filter((label) =>
			shownOn(owner, steamId)({ parsed: label.conditions })
		);
		if (candidates.length === 0) {
			return okAsync(0);
		}

		return this.services.labelAuto
			.assignedTo(steamId)
			.andThen((have) =>
				all(
					candidates
						.filter((label) => !have.has(label.id))
						.map((label) =>
							this.progressOrSkip(label.id, label.conditions, metric).map((progress) =>
								progress && progress.overall >= 1 ? [label.id] : []
							)
						)
				)
			)
			.andThen((met) => this.services.labelAuto.grantTo(steamId, met.flat()))
			.orElse((error) => {
				console.warn('[rewards] conditional labels failed', steamId, error);
				return okAsync(0);
			});
	}

	/**
	 * Unlocks every reward and assigns every label one Steam ID now qualifies for. The main
	 * Steam ID also gets the user's legacy (per-account) unlocks, whatever its progress.
	 */
	private evaluateSteamId(
		owner: Owner,
		steamId: string,
		catalog: Catalog,
		legacy: Map<string, string>
	): Task<void> {
		const metric = this.metrics(forSteamId(owner, steamId));
		const main = owner.steamIds[0] === steamId;
		// Another account lists this Steam ID too: its account rewards would not be this user's.
		const shared = owner.shared.has(steamId);
		return this.unlocked(steamId).andThen((unlocks) => {
			const have = new Set(unlocks.map((unlock) => unlock.reward));
			const missing = catalog.rewards.filter(
				(reward) => !have.has(reward.id) && !(shared && isAccountReward(reward.parsed))
			);
			const carried = main ? missing.filter((reward) => legacy.has(reward.id)) : [];
			return all(
				missing
					.filter((reward) => !carried.includes(reward))
					.map((reward) =>
						this.progressOrSkip(reward.id, reward.parsed, metric).map((progress) =>
							progress && progress.overall >= 1 ? [reward] : []
						)
					)
			)
				.andThen((earned) =>
					sequence([...carried, ...earned.flat()], (reward) => {
						// A legacy unlock keeps its date and was announced back then.
						const earlier = legacy.get(reward.id);
						return this.unlock(
							steamId,
							reward.id,
							earlier ?? new Date().toISOString(),
							earlier === undefined
						);
					})
				)
				.andThen((created) =>
					created.some(Boolean) ? uncache(`rewards:player:${steamId}`) : okAsync(undefined)
				)
				.andThen(() => this.evaluateLabels(owner, steamId, catalog.labels, metric))
				.map(() => undefined);
		});
	}

	/**
	 * Announces the unlocks of every Steam ID that were not announced yet, each reward once.
	 * They stay pending until the notification is sent, so a failed run retries it. At least
	 * once, not exactly once: clearing first would lose the notification when sending fails,
	 * and PocketBase has no conditional update to let only one of two runs clear a row. Two
	 * runs only evaluate one user together when both pass `claim`'s re-read.
	 */
	private notifyPending(userId: string, steamIds: string[], rewards: Reward[]): Task<number> {
		if (steamIds.length === 0) {
			return okAsync(0);
		}

		const ofSteamIds = steamIds
			.map((steamId) => this.pb.filter('steamId = {:steamId}', { steamId }))
			.join(' || ');
		return fromPb(
			this.unlocks.getFullList<{ id: string; reward: string }>({
				filter: `pendingNotify = true && (${ofSteamIds})`,
				fields: 'id,reward'
			}),
			'Could not load rewards'
		).andThen((pending) => {
			// A reward disabled since it unlocked is cleared without a notification.
			const byId = new Map(rewards.map((reward) => [reward.id, reward]));
			const fresh = [
				...new Map(
					pending.flatMap((row) => {
						const reward = byId.get(row.reward);
						return reward ? [[reward.id, reward] as const] : [];
					})
				).values()
			];
			return this.notify(userId, fresh)
				.andThen(() =>
					sequence(chunk(pending, PB_BATCH), (rows) => {
						const batch = this.pb.createBatch();
						for (const row of rows) {
							batch.collection('steam_rewards').update(row.id, { pendingNotify: false });
						}

						return fromPb(batch.send(), 'Could not save rewards');
					})
				)
				.map(() => fresh.length);
		});
	}

	/** Unlocks every reward the user's Steam IDs now qualify for; returns how many were announced. */
	private evaluate(userId: string, catalog: Catalog): Task<number> {
		return ResultAsync.combine([this.owner(userId), this.legacyUnlocks(userId)]).andThen(
			([owner, legacy]) =>
				sequence(owner.steamIds, (steamId) => this.evaluateSteamId(owner, steamId, catalog, legacy))
					.andThen(() => this.notifyPending(userId, owner.steamIds, catalog.rewards))
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
		);
	}

	private setCheckedAt(userId: string, checkedAt: string): Task<void> {
		return fromPb(
			this.pb.collection('users').update(userId, { rewardsCheckedAt: checkedAt }),
			'Could not save rewards check'
		).map(() => undefined);
	}

	/**
	 * Evaluates one claimed user. A failure backs off (`retryAt`). Never fails, so one user
	 * cannot stop the run or hold the front of the queue.
	 */
	private evaluateClaimed(userId: string, catalog: Catalog, version: string): Task<number> {
		return this.evaluate(userId, catalog).orElse((error) => {
			console.warn('[rewards] evaluate failed', userId, error);
			return this.setCheckedAt(userId, retryAt(version))
				.map(() => 0)
				.orElse((error) => {
					console.warn('[rewards] could not save rewards check', userId, error);
					return okAsync(0);
				});
		});
	}

	/** The users due for evaluation (see `evaluateDue`), oldest first. */
	private dueUsers(version: string): Task<DueUser[]> {
		const dayAgo = pbDate(new Date(Date.now() - DAY_MS));
		const staleBefore = version > dayAgo ? version : dayAgo;
		return fromPb(
			this.pb.collection('users').getList<DueUser>(1, BATCH, {
				filter: this.pb.filter('rewardsCheckedAt = "" || rewardsCheckedAt < {:staleBefore}', {
					staleBefore
				}),
				sort: 'rewardsCheckedAt',
				fields: 'id,rewardsCheckedAt',
				skipTotal: true
			}),
			'Could not load users'
		).map((page) => page.items);
	}

	/**
	 * Claims the whole page in one batch before evaluating any of it (`rewardsCheckedAt` =
	 * the run's start), then keeps the users that still carry this run's claim: one an
	 * overlapping run claimed since, or a `markDirty` queued again, is left to the next run.
	 * Two runs that list the same users and both re-read before the other's claim can still
	 * both evaluate one; the window is a few requests wide. A claimed user is not due again
	 * for a day, so a run that dies mid-evaluation (Worker limit, deploy) leaves it until the
	 * daily re-check or its next `markDirty`. A shorter claim would need a second write on
	 * success, which would overwrite a `markDirty` made during the evaluation.
	 */
	private claim(users: DueUser[], claimedAt: string): Task<string[]> {
		if (users.length === 0) {
			return okAsync([]);
		}

		const batch = this.pb.createBatch();
		for (const user of users) {
			batch.collection('users').update(user.id, { rewardsCheckedAt: claimedAt });
		}

		const ofUsers = users.map((user) => this.pb.filter('id = {:id}', { id: user.id })).join(' || ');
		return fromPb(batch.send(), 'Could not claim users')
			.andThen(() =>
				fromPb(
					this.pb.collection('users').getFullList<{ id: string }>({
						filter: `(${ofUsers}) && ${this.pb.filter('rewardsCheckedAt = {:claimedAt}', { claimedAt })}`,
						fields: 'id'
					}),
					'Could not load users'
				)
			)
			.map((rows) => {
				const kept = new Set(rows.map((row) => row.id));
				return users.map((user) => user.id).filter((id) => kept.has(id));
			});
	}

	/** Gives users this run claimed but had no time for their old place in the queue back. */
	private release(users: DueUser[]): Task<void> {
		if (users.length === 0) {
			return okAsync(undefined);
		}

		const batch = this.pb.createBatch();
		for (const user of users) {
			batch
				.collection('users')
				.update(user.id, { rewardsCheckedAt: user.rewardsCheckedAt || null });
		}

		return fromPb(batch.send(), 'Could not release users')
			.map(() => undefined)
			.orElse((error) => {
				console.warn('[rewards] could not release users', error);
				return okAsync(undefined);
			});
	}

	/**
	 * Job: evaluates users that are queued, never checked, checked before the last reward
	 * edit, or not checked for a day — oldest first. The daily re-check covers time-based
	 * metrics (account age) and data written without a hook (fair play captures, profile
	 * edits, ratings from the harvest, play time). Also the retroactive backfill for existing
	 * users. Stops starting users once `BUDGET_MS` is spent and releases the rest.
	 */
	evaluateDue(): Task<{ processed: number; more: boolean }> {
		const started = Date.now();
		const claimedAt = pbDate(new Date(started));
		return this.freshCatalog().andThen((catalog) => {
			if (catalog.rewards.length === 0 && catalog.labels.length === 0) {
				return okAsync({ processed: 0, more: false });
			}

			return this.catalogVersion(catalog.labels).andThen((version) =>
				this.dueUsers(version).andThen((page) =>
					this.claim(page, claimedAt)
						.andThen((claimed) =>
							sequence(claimed, (userId) =>
								Date.now() - started > BUDGET_MS
									? okAsync(null)
									: this.evaluateClaimed(userId, catalog, version).map(() => userId)
							).andThen((done) => {
								const left = claimed.filter((userId) => !done.includes(userId));
								return this.release(page.filter((user) => left.includes(user.id))).map(
									() => done.filter(Boolean).length
								);
							})
						)
						.map((processed) => ({
							processed,
							more: page.length === BATCH || processed < page.length
						}))
				)
			);
		});
	}
}
