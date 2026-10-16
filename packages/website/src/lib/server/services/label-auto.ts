import { okAsync } from 'neverthrow';
import { parseRewardConditions } from '@company-of-heroes/api/rewards';
import { isLiveLabel } from '@company-of-heroes/ui/format/labels';
import type { RewardCondition } from '@company-of-heroes/ui/reward/metrics';
import { cached, uncache } from '../cache';
import { RELIC_BASE, type RelicResult } from '../clients/relic';
import { isValidSteamId, steamIdFromRelicName } from '../domain/ratings';
import { profileFromPersonalStat, type RelicPersonalStat } from '../domain/relic-matches';
import { chunk, fromPb, isUniqueCollision, pbMaybe, sequence, type Task } from '../result';
import { Service } from './service';

/** Automatch 1v1 (4–7) and 2v2 (8–11), one ladder per faction. */
const LADDER_IDS = [4, 5, 6, 7, 8, 9, 10, 11];
const TOP_RANK = 20;
/** Rank 20 on this many of those ladders earns an `autoRank20` label. */
const LADDERS_NEEDED = 2;
/** `steamId = a || …` per filter (PocketBase caps expressions per filter). */
const CHUNK = 100;
const CACHE_SECONDS = 60;
/** Relic's `getleaderboard2` returns at most 200 rows per call. */
const PAGE_SIZE = 200;
/**
 * Pages read per ladder. A ladder lists only its ranked players (about 1,900 on the busiest
 * 1v1 ladder in 2026), so 15 pages (3,000 rows) cover all of them; rows past that are left
 * out (logged). Every row counts: a low current rank can still carry a rank-20 high.
 */
const MAX_PAGES = 15;
/** Urls per Relic proxy call (the proxy takes 100); one call is one Worker subrequest. */
const URLS_PER_CALL = 40;
/**
 * New assignments per run, all from the one ladder read (about one subrequest each). Only
 * the first run after a new label gets near it; the rest follow on the next run (`more`).
 */
const GRANT_PER_RUN = 500;
/** Live-label assignments removed per `removeLiveExcept` run; the rest follow on the next run. */
const REMOVE_PER_RUN = 100;

type Candidate = { steamId: string; profileId: number; alias: string };

/** A label staff gave reward conditions; the rewards job assigns it once all are met. */
export type ConditionalLabel = { id: string; conditions: RewardCondition[]; updated: string };

type LadderStat = { leaderboard_id: number; ranklevel: number; highestranklevel?: number };

/** One `getleaderboard2` page, only the fields the job reads. */
type RelicLadderPage = {
	rankTotal?: number;
	statGroups?: {
		members?: {
			personal_statgroup_id: number;
			profile_id: number;
			alias?: string;
			name?: string;
		}[];
	}[];
	leaderboardStats?: (LadderStat & { statgroup_id: number })[];
};

type LadderRow = { candidate: Candidate; stat: LadderStat };

const ladderUrl = (leaderboardId: number, page: number) =>
	`${RELIC_BASE}/community/leaderboard/getleaderboard2?title=coh1&leaderboard_id=${leaderboardId}&start=${page * PAGE_SIZE + 1}&count=${PAGE_SIZE}`;

/** Rows of one page joined to their member, with the current and the highest rank level. */
function ladderRows(data: RelicLadderPage): LadderRow[] {
	const members = new Map(
		(data.statGroups ?? [])
			.flatMap((group) => group.members ?? [])
			.map((member) => [member.personal_statgroup_id, member])
	);
	return (data.leaderboardStats ?? []).flatMap((stat) => {
		const member = members.get(stat.statgroup_id);
		const steamId = steamIdFromRelicName(member?.name ?? '');
		const profileId = Number(member?.profile_id) || 0;
		if (!member || !isValidSteamId(steamId) || profileId <= 0) {
			return [];
		}

		return [
			{
				candidate: { steamId, profileId, alias: member.alias ?? '' },
				stat: {
					leaderboard_id: Number(stat.leaderboard_id) || 0,
					ranklevel: Number(stat.ranklevel) || 0,
					highestranklevel: Number(stat.highestranklevel) || 0
				}
			}
		];
	});
}

/** Rank 20 now or ever, on two of the 1v1/2v2 ladders. */
function qualifies(stats: LadderStat[]): boolean {
	const ladders = new Set(
		stats
			.filter((stat) => LADDER_IDS.includes(Number(stat.leaderboard_id)))
			.filter(
				(stat) =>
					Math.max(Number(stat.ranklevel) || 0, Number(stat.highestranklevel) || 0) >= TOP_RANK
			)
			.map((stat) => Number(stat.leaderboard_id))
	);
	return ladders.size >= LADDERS_NEEDED;
}

/**
 * Labels staff marked `autoRank20` (Veteran) go to every Steam ID with rank 20 (now or ever)
 * on two of the 1v1/2v2 ladders, in any mix of mode and faction. The job reads every ranked
 * player on those ladders; linked accounts are also checked on their personal stats (rewards
 * evaluate). An assignment is never taken back, except a live label (conditions with
 * `supporter_active`), which `removeFrom` / `removeLiveExcept` take back once the account's
 * subscription ends; when staff remove one by hand, a `player_label_revocations` row keeps
 * it from coming back. Labels with reward conditions are checked by the `rewards-evaluate`
 * job and assigned through `grantTo`.
 */
export class LabelAutoService extends Service {
	private autoLabelIds(): Task<string[]> {
		return fromPb(
			this.pb.collection('user_labels').getFullList<{ id: string }>({
				filter: 'autoRank20 = true',
				fields: 'id'
			}),
			'Could not load labels'
		).map((rows) => rows.map((row) => row.id));
	}

	/** `label:steamId` pairs of an assignments-shaped collection; a missing collection has none. */
	private pairs(
		collection: 'player_label_assignments' | 'player_label_revocations',
		labelIds: string[],
		steamIds: string[]
	): Task<Set<string>> {
		const labels = labelIds.map((id) => this.pb.filter('label = {:id}', { id })).join(' || ');
		return sequence(chunk(steamIds, CHUNK), (part) =>
			pbMaybe(
				this.pb.collection(collection).getFullList<{
					steamId: string;
					label: string;
				}>({
					filter: `(${labels}) && (${part.map((steamId) => this.pb.filter('steamId = {:steamId}', { steamId })).join(' || ')})`,
					fields: 'steamId,label'
				}),
				'Could not load labels'
			).map((rows) => rows ?? [])
		).map((pages) => new Set(pages.flat().map((row) => `${row.label}:${row.steamId}`)));
	}

	/** Staff removed this label from the Steam ID by hand; jobs must not give it back. */
	revoked(steamId: string, labelId: string): Task<boolean> {
		return this.pairs('player_label_revocations', [labelId], [steamId]).map((pairs) =>
			pairs.has(`${labelId}:${steamId}`)
		);
	}

	/** One assignment; false when it already existed or failed (logged), so the others still run. */
	private create(candidate: Candidate, labelId: string): Task<boolean> {
		return fromPb(
			this.pb
				.collection('player_label_assignments')
				.create({
					steamId: candidate.steamId,
					profileId: candidate.profileId,
					alias: candidate.alias || undefined,
					label: labelId
				})
				.then(() => true)
				.catch((error) => {
					if (!isUniqueCollision(error)) {
						console.error('[labels] could not assign', labelId, candidate.steamId, error);
					}

					return false;
				}),
			'Could not assign label'
		);
	}

	/**
	 * Assigns every auto label the candidates do not have yet and staff did not revoke, at
	 * most `limit`; returns how many were new and whether some are left for a next run.
	 */
	private grant(
		labelIds: string[],
		candidates: Candidate[],
		limit = Number.POSITIVE_INFINITY
	): Task<{ granted: number; more: boolean }> {
		if (labelIds.length === 0 || candidates.length === 0) {
			return okAsync({ granted: 0, more: false });
		}

		const steamIds = candidates.map((candidate) => candidate.steamId);
		return this.pairs('player_label_assignments', labelIds, steamIds).andThen((have) =>
			this.pairs('player_label_revocations', labelIds, steamIds).andThen((revoked) => {
				const missing = candidates.flatMap((candidate) =>
					labelIds
						.filter((labelId) => {
							const key = `${labelId}:${candidate.steamId}`;
							return !have.has(key) && !revoked.has(key);
						})
						.map((labelId) => ({ candidate, labelId }))
				);
				const batch = missing.slice(0, limit);
				return sequence(batch, ({ candidate, labelId }) => this.create(candidate, labelId)).map(
					(created) => ({
						granted: created.filter(Boolean).length,
						more: missing.length > batch.length
					})
				);
			})
		);
	}

	/** Relic pages in proxy calls of `URLS_PER_CALL`; a failed call yields failed results. */
	private fetchPages(urls: string[]): Task<RelicResult<RelicLadderPage>[]> {
		return sequence(chunk(urls, URLS_PER_CALL), (part) =>
			this.relic
				.getMany<RelicLadderPage>(part)
				.orElse((error) =>
					okAsync(
						part.map(
							(url): RelicResult<RelicLadderPage> => ({ url, ok: false, error: error.message })
						)
					)
				)
		).map((parts) => parts.flat());
	}

	/** Pages after the first one of a ladder, up to `MAX_PAGES`; none when the first failed. */
	private morePages(leaderboardId: number, first: RelicResult<RelicLadderPage> | undefined) {
		if (!first?.ok) {
			return [];
		}

		const total = Number(first.body.rankTotal) || 0;
		if (total > MAX_PAGES * PAGE_SIZE) {
			console.warn('[labels] ladder longer than the pages read', leaderboardId, total);
		}

		const pages = Math.min(MAX_PAGES, Math.ceil(total / PAGE_SIZE));
		return Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
			ladderUrl(leaderboardId, i + 1)
		);
	}

	/**
	 * Every ranked row of the 1v1/2v2 ladders (up to `MAX_PAGES` each). A ladder or page
	 * that fails is logged and left out; the rest still counts. About 120 pages in 4 proxy
	 * calls, so the job stays far below the Worker subrequest limit.
	 */
	private ladderRows(): Task<LadderRow[]> {
		return this.fetchPages(LADDER_IDS.map((id) => ladderUrl(id, 0))).andThen((firsts) =>
			this.fetchPages(LADDER_IDS.flatMap((id, i) => this.morePages(id, firsts[i]))).map((rest) => {
				const pages = [...firsts, ...rest];
				for (const page of pages) {
					if (!page.ok) {
						console.error('[labels] ladder page failed, skipped', page.url, page.error);
					}
				}

				return pages.flatMap((page) => (page.ok ? ladderRows(page.body) : []));
			})
		);
	}

	/** Job: every ranked player on the 1v1/2v2 ladders with rank 20 (now or ever) on two. */
	run(): Task<{ processed: number; more: boolean }> {
		return this.autoLabelIds().andThen((labelIds) => {
			if (labelIds.length === 0) {
				return okAsync({ processed: 0, more: false });
			}

			return this.ladderRows().andThen((rows) => {
				const stats = new Map<string, { candidate: Candidate; stats: LadderStat[] }>();
				for (const row of rows) {
					const entry = stats.get(row.candidate.steamId) ?? {
						candidate: row.candidate,
						stats: []
					};
					entry.stats.push(row.stat);
					stats.set(row.candidate.steamId, entry);
				}

				const candidates = [...stats.values()]
					.filter((entry) => qualifies(entry.stats))
					.map((entry) => entry.candidate);
				return this.grant(labelIds, candidates, GRANT_PER_RUN).map(({ granted, more }) => ({
					processed: granted,
					more
				}));
			});
		});
	}

	/** Linked Steam IDs, on their highest rank ever (a ladder only shows the current one). */
	grantForSteamIds(steamIds: string[]): Task<number> {
		const ids = steamIds.filter(isValidSteamId);
		if (ids.length === 0) {
			return okAsync(0);
		}

		return this.autoLabelIds().andThen((labelIds) => {
			if (labelIds.length === 0) {
				return okAsync(0);
			}

			const urls = ids.map(
				(steamId) =>
					`${RELIC_BASE}/community/leaderboard/getpersonalstat?title=coh1&profile_names=${encodeURIComponent(JSON.stringify([`/steam/${steamId}`]))}`
			);
			return this.relic.getMany<RelicPersonalStat>(urls).andThen((results) => {
				const candidates = ids.flatMap((steamId, i) => {
					const result = results[i];
					const profile = result?.ok
						? profileFromPersonalStat(result.body, (member) => member.name === `/steam/${steamId}`)
						: null;
					if (!profile?.profile_id || !qualifies(profile.leaderboardStats)) {
						return [];
					}

					return [{ steamId, profileId: profile.profile_id, alias: profile.alias }];
				});
				return this.grant(labelIds, candidates).map(({ granted }) => granted);
			});
		});
	}

	/** Labels with valid reward conditions. */
	conditionalLabels(): Task<ConditionalLabel[]> {
		return cached('labels:conditional', CACHE_SECONDS, () =>
			fromPb(
				this.pb
					.collection('user_labels')
					.getFullList<{ id: string; conditions: unknown; updated: string }>({
						fields: 'id,conditions,updated'
					}),
				'Could not load labels'
			)
		).map((rows) =>
			rows.flatMap((row) => {
				if (row.conditions === null || row.conditions === undefined || row.conditions === '') {
					return [];
				}

				const conditions = parseRewardConditions(row.conditions);
				if (!conditions) {
					console.warn('[labels] invalid conditions, skipped', row.id);
					return [];
				}

				return [{ id: row.id, conditions, updated: row.updated }];
			})
		);
	}

	/** Ids of the labels one Steam ID already has. */
	assignedTo(steamId: string): Task<Set<string>> {
		return fromPb(
			this.pb.collection('player_label_assignments').getFullList<{ label: string }>({
				filter: this.pb.filter('steamId = {:steamId}', { steamId }),
				fields: 'label'
			}),
			'Could not load labels'
		).map((rows) => new Set(rows.map((row) => row.label)));
	}

	/** Relic profile of a Steam ID: the stored rating row, else Relic itself. */
	private candidate(steamId: string): Task<Candidate | null> {
		return fromPb(
			this.pb.collection('player_ratings').getList<{ profileId: number; alias: string }>(1, 1, {
				filter: this.pb.filter('steamId = {:steamId}', { steamId }),
				fields: 'profileId,alias',
				skipTotal: true
			}),
			'Could not load ratings'
		).andThen((page) => {
			const row = page.items[0];
			if (row && Number(row.profileId) > 0) {
				return okAsync<Candidate | null>({
					steamId,
					profileId: Number(row.profileId),
					alias: row.alias ?? ''
				});
			}

			return this.relic
				.get<RelicPersonalStat>(
					`/community/leaderboard/getpersonalstat?title=coh1&profile_names=${encodeURIComponent(JSON.stringify([`/steam/${steamId}`]))}`
				)
				.map((data): Candidate | null => {
					const profile = profileFromPersonalStat(
						data,
						(member) => member.name === `/steam/${steamId}`
					);
					return profile?.profile_id
						? { steamId, profileId: profile.profile_id, alias: profile.alias }
						: null;
				})
				.orElse(() => okAsync(null));
		});
	}

	/** Assigns labels whose conditions one Steam ID met; returns how many were new. */
	grantTo(steamId: string, labelIds: string[]): Task<number> {
		if (labelIds.length === 0 || !isValidSteamId(steamId)) {
			return okAsync(0);
		}

		return this.candidate(steamId).andThen((candidate) =>
			candidate ? this.grant(labelIds, [candidate]).map(({ granted }) => granted) : okAsync(0)
		);
	}

	/** Deletes assignments one by one (a failure is logged and skipped); returns how many went. */
	private remove(rows: { id: string; steamId: string }[]): Task<number> {
		return sequence(rows, (row) =>
			fromPb(
				this.pb
					.collection('player_label_assignments')
					.delete(row.id)
					.catch((error) => {
						console.error('[labels] could not remove', row.id, row.steamId, error);
						return false;
					}),
				'Could not remove label'
			)
		).andThen((removed) =>
			// The player page caches its labels.
			sequence([...new Set(rows.map((row) => row.steamId))], (steamId) =>
				uncache(`player:${steamId}`)
			).map(() => removed.filter(Boolean).length)
		);
	}

	/** Takes live labels whose conditions stopped holding back from one Steam ID; returns how many. */
	removeFrom(steamId: string, labelIds: string[]): Task<number> {
		if (labelIds.length === 0) {
			return okAsync(0);
		}

		const labels = labelIds.map((id) => this.pb.filter('label = {:id}', { id })).join(' || ');
		return fromPb(
			this.pb.collection('player_label_assignments').getFullList<{ id: string; steamId: string }>({
				filter: `${this.pb.filter('steamId = {:steamId}', { steamId })} && (${labels})`,
				fields: 'id,steamId'
			}),
			'Could not load labels'
		).andThen((rows) => this.remove(rows));
	}

	/**
	 * Job step: removes live-label assignments on Steam IDs outside `keep` (the non-shared
	 * Steam IDs of active supporters), at most `REMOVE_PER_RUN`. Covers a Steam ID unlinked
	 * from a supporter's account and a subscription whose end no webhook announced. A live
	 * label staff assigned by hand to a non-supporter is removed too (live by design). The
	 * assignments are read before `keep` is loaded, so one a new supporter's webhook created
	 * meanwhile is never seen with a stale `keep`; any failed read removes nothing.
	 */
	removeLiveExcept(keep: () => Task<Set<string>>): Task<{ processed: number; more: boolean }> {
		return this.conditionalLabels().andThen((labels) => {
			const live = labels.filter((label) => isLiveLabel(label.conditions));
			if (live.length === 0) {
				return okAsync({ processed: 0, more: false });
			}

			return fromPb(
				this.pb
					.collection('player_label_assignments')
					.getFullList<{ id: string; steamId: string }>({
						filter: live
							.map((label) => this.pb.filter('label = {:id}', { id: label.id }))
							.join(' || '),
						fields: 'id,steamId'
					}),
				'Could not load labels'
			).andThen((rows) =>
				keep().andThen((supporters) => {
					const stale = rows.filter((row) => !supporters.has(row.steamId));
					const batch = stale.slice(0, REMOVE_PER_RUN);
					return this.remove(batch).map((processed) => ({
						processed,
						more: stale.length > batch.length
					}));
				})
			);
		});
	}
}
