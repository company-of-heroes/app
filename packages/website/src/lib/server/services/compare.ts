import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { cached } from '../cache';
import { badRequest } from '../errors';
import { all, chunk, fromPb, type Task } from '../result';
import { bestElo, bestRanks, type Compare } from '../domain/compare';
import { emptyHeadToHead, type HeadToHead } from '../domain/head-to-head';
import { toEloMap, type EloMap } from '../domain/ratings';
import {
	profileFromPersonalStat,
	type RelicPersonalStat,
	type RelicProfile
} from '../domain/relic-matches';
import { Service } from './service';

const CACHE_SECONDS = 45;
/** Relic getpersonalstat accepts at most 10 profile names per request. */
const PERSONAL_STAT_BATCH = 10;

export class CompareService extends Service {
	/** Each account's Relic profile (ladder stats, profile id); an account Relic does not know is left out. */
	private profiles(steamIds: string[]): Task<Map<string, RelicProfile>> {
		return all(
			chunk(steamIds, PERSONAL_STAT_BATCH).map((ids) =>
				this.relic
					.get<RelicPersonalStat>(
						`/community/leaderboard/getpersonalstat?title=coh1&profile_names=${encodeURIComponent(
							JSON.stringify(ids.map((id) => `/steam/${id}`))
						)}`
					)
					.map((data) =>
						ids.flatMap((id) => {
							// Each account has its own stat group in the response.
							for (const group of data.statGroups ?? []) {
								const profile = profileFromPersonalStat(
									{ ...data, statGroups: [group] },
									(member) => member.name === `/steam/${id}`
								);
								if (profile) {
									return [[id, profile] as const];
								}
							}

							return [];
						})
					)
			)
		).map((pages) => new Map(pages.flat()));
	}

	private elo(steamIds: string[]): Task<{ steamId: string; elo: EloMap }[]> {
		return fromPb(
			this.pb.collection('player_ratings').getFullList<{ steamId: string; elo: unknown }>({
				filter: steamIds
					.map((steamId) => this.pb.filter('steamId = {:steamId}', { steamId }))
					.join(' || '),
				fields: 'steamId,elo'
			}),
			'Could not load ratings'
		).map((rows) => rows.map((row) => ({ steamId: row.steamId, elo: toEloMap(row.elo) })));
	}

	private load(
		userId: string,
		them: string,
		linked: { steamId: string; name: string | null; avatarUrl: string | null }[],
		selected: string[]
	): Task<Compare> {
		const { playerPage, performance, headToHead } = this.services;
		const linkedIds = linked.map((account) => account.steamId);
		return ResultAsync.combine([
			playerPage.get(them),
			this.profiles(linkedIds),
			this.elo(selected),
			performance.ofSteamIds(selected)
		]).andThen(([page, profiles, elo, myPerformance]) => {
			const isSelf =
				linkedIds.includes(page.steamId) ||
				[...profiles.values()].some((profile) => profile.profile_id === page.profileId);
			const record: Task<HeadToHead> = isSelf
				? okAsync(emptyHeadToHead(page.profileId))
				: headToHead
						.forUser(userId, null, [page.profileId], selected)
						.map((byProfile) => byProfile[page.profileId] ?? emptyHeadToHead(page.profileId));
			return ResultAsync.combine([record, performance.ofProfile(page.profileId)]).map(
				([headToHeadRecord, theirPerformance]): Compare => ({
					accounts: linked.map((account) => ({
						...account,
						profileId: profiles.get(account.steamId)?.profile_id ?? null,
						selected: selected.includes(account.steamId)
					})),
					isSelf,
					me: {
						performance: myPerformance,
						best: bestRanks(
							selected.flatMap((steamId) => {
								const profile = profiles.get(steamId);
								return profile ? [{ steamId, leaderboardStats: profile.leaderboardStats }] : [];
							})
						),
						elo: bestElo(elo)
					},
					them: {
						steamId: page.steamId,
						profileId: page.profileId,
						alias: page.alias,
						avatarUrl: page.avatarUrl || null,
						country: page.country,
						level: page.level,
						leaderboardStats: page.leaderboardStats,
						elo: page.elo,
						performance: theirPerformance
					},
					headToHead: headToHeadRecord
				})
			);
		});
	}

	/**
	 * You against a player (Steam id or Relic profile id). `steamIds` picks which of the user's
	 * linked accounts count (all when omitted); ids that are not theirs are dropped.
	 */
	get(userId: string, them: string, steamIds?: string[]): Task<Compare> {
		return this.services.users.steamAccounts(userId).andThen((linked) => {
			const linkedIds = linked.map((account) => account.steamId);
			const selected = (
				steamIds?.length ? [...new Set(steamIds)].filter((id) => linkedIds.includes(id)) : linkedIds
			).sort();
			if (selected.length === 0) {
				return errAsync(badRequest('Select at least one of your accounts.'));
			}

			return cached(`compare:${userId}:${selected.join(',')}:${them}`, CACHE_SECONDS, () =>
				this.load(userId, them, linked, selected)
			);
		});
	}
}
