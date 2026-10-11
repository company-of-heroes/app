import { okAsync, ResultAsync } from 'neverthrow';
import { cached } from '../cache';
import { avatarOf } from '../clients/steam';
import { eloSlotCount, steamIdFromRelicName, toEloMap } from '../domain/ratings';
import { badRequest } from '../errors';
import { ensure, fromPb, type Task } from '../result';
import { Service } from './service';

export type PlayerSearchItem = {
	profileId: number;
	alias: string;
	country: string | null;
	level: number;
	steamId: string;
	avatarUrl: string;
	matchCount: number;
	likeCount?: number;
};

type RelicMember = {
	profile_id: number;
	alias?: string;
	country?: string;
	level?: number;
	name?: string;
	personal_statgroup_id?: number;
};
type RelicPersonalStat = {
	result?: { code?: number };
	statGroups?: { members?: RelicMember[] }[];
	leaderboardStats?: { statgroup_id: number; wins?: number; losses?: number }[];
};

const MAX_RESULTS = 20;
/** Results per page of the player search. */
export const SEARCH_PAGE_SIZE = 20;
/** Stored players fetched per query (prefix and contains) before ranking. */
const CANDIDATES = 500;
/** Shortest query that also searches inside names when few names start with it. */
const CONTAINS_MIN_LENGTH = 3;
/** Relic's "no match" result code for fuzzy search; then try the exact alias. */
const RELIC_NOT_FOUND = 10;

function uniqueMembers(data: RelicPersonalStat): RelicMember[] {
	const seen = new Set<number>();
	return (data.statGroups ?? [])
		.flatMap((group) => group.members ?? [])
		.filter((member) => {
			const id = Number(member.profile_id);
			if (!id || seen.has(id)) {
				return false;
			}

			seen.add(id);
			return true;
		});
}
type RelicSearch = { members: RelicMember[]; stats: RelicStat[] };
type RelicStat = NonNullable<RelicPersonalStat['leaderboardStats']>[number];

const personalStat = (query: string) =>
	`/community/leaderboard/getpersonalstat?title=coh1&${query}`;

/** A search hit before the Steam avatar and like count are added. */
type Found = Omit<PlayerSearchItem, 'avatarUrl' | 'likeCount'>;
type StoredPlayer = {
	steamId: string;
	profileId: number;
	alias: string;
	country?: string;
	elo: unknown;
};

/** Stored players only exist after a rated game, so their filled ELO slots stand in for games played. */
const fromStored = (row: StoredPlayer): Found => ({
	profileId: Number(row.profileId) || 0,
	alias: row.alias,
	country: row.country || null,
	level: 0,
	steamId: row.steamId,
	matchCount: eloSlotCount(toEloMap(row.elo))
});

export type PlayerSearchPage = { items: PlayerSearchItem[]; total: number; more: boolean };

/** 0 exact, 1 starts with, 2 a word starts with, 3 contains; null when the alias does not contain it. */
function relevance(alias: string, query: string): number | null {
	const name = alias.toLowerCase();
	const index = name.indexOf(query);
	if (index < 0) {
		return null;
	}

	if (name === query) {
		return 0;
	}

	if (index === 0) {
		return 1;
	}

	return name.split(/[\s_\-.[\]|]+/).some((word) => word.startsWith(query)) ? 2 : 3;
}

/** Best match first; within a tier more games, then the shorter name. */
function byRelevance(found: Found[], query: string): Found[] {
	const q = query.toLowerCase();
	return found
		.map((player) => ({ player, tier: relevance(player.alias, q) }))
		.filter((hit): hit is { player: Found; tier: number } => hit.tier !== null)
		.sort(
			(a, b) =>
				a.tier - b.tier ||
				b.player.matchCount - a.player.matchCount ||
				a.player.alias.length - b.player.alias.length ||
				a.player.alias.localeCompare(b.player.alias)
		)
		.map((hit) => hit.player);
}

function fromRelic({ members, stats }: RelicSearch): Found[] {
	return members.map((member) => ({
		profileId: Number(member.profile_id) || 0,
		alias: member.alias ?? '',
		country: member.country ?? null,
		level: Number(member.level) || 0,
		steamId: steamIdFromRelicName(member.name),
		matchCount: stats
			.filter((stat) => stat.statgroup_id === member.personal_statgroup_id)
			.reduce((total, stat) => total + (Number(stat.wins) || 0) + (Number(stat.losses) || 0), 0)
	}));
}

export class PlayersService extends Service {
	private storedMatching(filter: string, sort: string): Task<StoredPlayer[]> {
		return fromPb(
			this.pb.collection('player_ratings').getList<StoredPlayer>(1, CANDIDATES, {
				filter,
				sort,
				fields: 'steamId,profileId,alias,country,elo',
				skipTotal: true
			}),
			'Could not search players'
		).map((rows) => rows.items);
	}

	/**
	 * Players we already store (from lobby results and Relic harvests). Names that start with
	 * the query come from an index range on `alias_lower`; only when that fills less than a
	 * page (and the query has 3+ characters) is the slower "contains" scan added.
	 */
	private searchStored(query: string): Task<Found[]> {
		const lower = query.toLowerCase();
		return this.storedMatching(
			this.pb.filter('alias_lower >= {:from} && alias_lower < {:to}', {
				from: lower,
				to: `${lower}\uffff`
			}),
			'alias_lower'
		)
			.andThen((prefix) =>
				prefix.length < SEARCH_PAGE_SIZE && query.length >= CONTAINS_MIN_LENGTH
					? this.storedMatching(this.pb.filter('alias ~ {:query}', { query }), '-updated').map(
							(contains) => [...prefix, ...contains]
						)
					: okAsync(prefix)
			)
			.map((rows) => {
				const unique = new Map(rows.map((row) => [row.steamId, row]));
				return [...unique.values()].map(fromStored);
			});
	}

	/** Relic name search; falls back to an exact alias lookup when the fuzzy search finds nothing. */
	private searchRelic(query: string): Task<RelicSearch> {
		return this.relic
			.get<RelicPersonalStat>(personalStat(`search=${encodeURIComponent(query)}`))
			.andThen((data) =>
				data.result?.code !== RELIC_NOT_FOUND
					? okAsync({
							members: uniqueMembers(data).slice(0, MAX_RESULTS),
							stats: data.leaderboardStats ?? []
						})
					: this.exactAlias(query)
			);
	}

	private exactAlias(query: string): Task<RelicSearch> {
		return this.relic
			.get<RelicPersonalStat>(
				personalStat(`aliases=${encodeURIComponent(JSON.stringify([query]))}`)
			)
			.map((exact) => {
				const members = uniqueMembers(exact);
				const sameAlias = members.filter(
					(member) => (member.alias ?? '').toLowerCase() === query.toLowerCase()
				);
				return {
					members: (sameAlias.length > 0 ? sameAlias : members.slice(0, 1)).slice(0, MAX_RESULTS),
					stats: exact.leaderboardStats ?? []
				};
			});
	}

	/**
	 * Stored players first; Relic is only asked when none match (or the lookup fails).
	 * Ranked by relevance, without the players `requireMatches` leaves out.
	 */
	private find(query: string, requireMatches: boolean): Task<Found[]> {
		return this.searchStored(query)
			.orElse(() => okAsync<Found[]>([]))
			.map((found) => byRelevance(found, query))
			.andThen((found) =>
				found.length > 0
					? okAsync(found)
					: this.searchRelic(query).map((relic) => byRelevance(fromRelic(relic), query))
			)
			.map((found) =>
				found
					.filter((player) => player.profileId > 0)
					.filter((player) => !requireMatches || (player.matchCount > 0 && Boolean(player.steamId)))
			);
	}

	/** Steam avatar and like score for one page of hits. */
	private enrich(found: Found[]): Task<PlayerSearchItem[]> {
		const steamIds = found.map((player) => player.steamId);
		return ResultAsync.combine([
			this.steam.playerSummaries(steamIds.filter(Boolean)),
			this.services.playerInfo.likeCounts(steamIds)
		]).map(([summaries, likes]) =>
			found.map((player): PlayerSearchItem => {
				const item: PlayerSearchItem = {
					...player,
					avatarUrl: avatarOf(summaries.get(player.steamId))
				};
				if (likes.has(player.steamId)) {
					item.likeCount = likes.get(player.steamId);
				}

				return item;
			})
		);
	}

	/**
	 * One page of players by name (stored, else Relic), most relevant first, with Steam
	 * avatar, total games and like score. `requireMatches` keeps only Steam players who
	 * have played at least one game.
	 */
	searchPage(query: string, requireMatches: boolean, page = 1): Task<PlayerSearchPage> {
		const q = query.trim();
		return ensure(q, badRequest('q is required'))
			.andThen(() => ensure(q.length <= 64, badRequest('q is too long')))
			.andThen(() => ensure(Number.isInteger(page) && page >= 1, badRequest('page is invalid')))
			.asyncAndThen(() =>
				cached(`players:search:v4:${requireMatches ? 1 : 0}:${q.toLowerCase()}`, 60, () =>
					this.find(q, requireMatches)
				)
			)
			.andThen((found) => {
				const start = (page - 1) * SEARCH_PAGE_SIZE;
				return this.enrich(found.slice(start, start + SEARCH_PAGE_SIZE)).map((items) => ({
					items,
					total: found.length,
					more: start + SEARCH_PAGE_SIZE < found.length
				}));
			});
	}

	/** The first page of `searchPage`. */
	search(query: string, requireMatches: boolean): Task<PlayerSearchItem[]> {
		return this.searchPage(query, requireMatches).map(({ items }) => items);
	}
}
