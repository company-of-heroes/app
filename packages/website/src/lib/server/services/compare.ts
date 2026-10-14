import { okAsync, ResultAsync } from 'neverthrow';
import { cached } from '../cache';
import { badRequest } from '../errors';
import { all, chunk, ensure, fromPb, type Task } from '../result';
import {
	COMPARE_ROW_FIELDS,
	rowsPerAccount,
	type Compare,
	type CompareAccountData,
	type CompareRow
} from '../domain/compare';
import { summarizePerformance } from '../domain/performance';
import { emptyHeadToHead, summarizeHeadToHead } from '../domain/head-to-head';
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

	private elo(steamIds: string[]): Task<Map<string, EloMap>> {
		return fromPb(
			this.pb.collection('player_ratings').getFullList<{ steamId: string; elo: unknown }>({
				filter: steamIds
					.map((steamId) => this.pb.filter('steamId = {:steamId}', { steamId }))
					.join(' || '),
				fields: 'steamId,elo'
			}),
			'Could not load ratings'
		).map((rows) => new Map(rows.map((row) => [row.steamId, toEloMap(row.elo)])));
	}

	/** Decided, counted index rows (hidden matches left out) matching `identity`. */
	private rows(identity: string): Task<CompareRow[]> {
		return ResultAsync.combine([
			fromPb(
				this.pb.collection('lobby_player_index').getFullList<CompareRow>({
					// `counts` = finished and not Skirmish
					filter: `(${identity}) && counts = true && session_id > 0 && (outcome = 0 || outcome = 1)`,
					fields: COMPARE_ROW_FIELDS,
					batch: 1000
				}),
				'Could not load matches'
			),
			this.services.hiddenMatches.lobbyIds()
		]).map(([rows, hiddenIds]) => rows.filter((row) => !hiddenIds.has(row.lobby)));
	}

	private load(userId: string, them: string, linkedIds: string[]): Task<Compare> {
		const { playerPage, headToHead, users } = this.services;
		const myRows = this.rows(
			linkedIds.map((steamId) => this.pb.filter('steam_id = {:steamId}', { steamId })).join(' || ')
		);
		return ResultAsync.combine([
			users.steamAccounts(userId),
			playerPage.get(them),
			this.profiles(linkedIds),
			this.elo(linkedIds),
			myRows
		]).andThen(([linked, page, profiles, elo, rows]) => {
			const isSelf =
				linkedIds.includes(page.steamId) ||
				[...profiles.values()].some((profile) => profile.profile_id === page.profileId);
			const theirRows: Task<CompareRow[]> = isSelf
				? okAsync([])
				: this.rows(this.pb.filter('profile_id = {:id}', { id: page.profileId }));
			const perAccount = rowsPerAccount(rows);
			return theirRows.andThen((theirs) =>
				all(
					linkedIds.map((steamId): Task<CompareAccountData> => {
						const mine = perAccount.get(steamId) ?? [];
						const record = isSelf
							? okAsync(emptyHeadToHead(page.profileId))
							: headToHead.withDates(summarizeHeadToHead(page.profileId, mine, theirs));
						return record.map((headToHeadRecord) => ({
							steamId,
							leaderboardStats: profiles.get(steamId)?.leaderboardStats ?? [],
							elo: elo.get(steamId) ?? {},
							performance: summarizePerformance(mine, { mapLimit: Infinity }),
							headToHead: headToHeadRecord
						}));
					})
				).map(
					(mine): Compare => ({
						accounts: linked.map((account) => ({
							...account,
							profileId: profiles.get(account.steamId)?.profile_id ?? null
						})),
						isSelf,
						mine,
						them: {
							steamId: page.steamId,
							profileId: page.profileId,
							alias: page.alias,
							avatarUrl: page.avatarUrl || null,
							country: page.country,
							level: page.level,
							leaderboardStats: page.leaderboardStats,
							elo: page.elo,
							performance: page.performance ?? summarizePerformance(theirs)
						}
					})
				)
			);
		});
	}

	/**
	 * You against a player (Steam id or Relic profile id), per linked account; the page
	 * combines the accounts the user selects, so toggling needs no new request.
	 */
	get(userId: string, them: string): Task<Compare> {
		return this.services.users
			.steamIdsOf(userId)
			.andThen((linkedIds) =>
				ensure(
					linkedIds.length > 0,
					badRequest('Link a Steam account to compare yourself.')
				).asyncAndThen(() =>
					cached(`compare:v2:${userId}:${them}`, CACHE_SECONDS, () =>
						this.load(userId, them, [...linkedIds].sort())
					)
				)
			);
	}
}
