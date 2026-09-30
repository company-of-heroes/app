import { err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import type { ReplaysQuery } from '@company-of-heroes/api';
import { cached } from '../cache';
import { mapDisplayName } from '../domain/map-name';
import { badRequest, unauthorized } from '../errors';
import { fromPb, type Task } from '../result';
import { Service } from './service';
import {
	filterAstSchema,
	flatParamsToAst,
	matchtypesForMatchups,
	planHistoryQuery,
	TooManyMatchesError,
	type FilterAst,
	type HistoryScope
} from '../domain/history-filter';
import {
	attachPlayerStats,
	HISTORY_ROW_FIELDS,
	rowsNeedingRawPlayers,
	toHistoryRow,
	type HistoryRow,
	type LobbyListRecord,
	type RawLobby
} from '../domain/history-rows';

export type HistorySort = 'createdAt' | 'likeCount' | 'downloadCount' | 'commentCount';

export type HistoryListInput = {
	scope: 'user' | 'community';
	page: number;
	perPage: number;
	filter: FilterAst | null;
	/** Relic profile to count as "me" in user scope, besides the account's Steam ids. */
	profileId?: number;
	includeSkirmish: boolean;
	sort: HistorySort;
	sortDir: 'asc' | 'desc';
};

export type HistoryViewer = { id: string; isStaff: boolean } | null;

export type HistoryPage = {
	page: number;
	perPage: number;
	/** Exact when cheap; otherwise the rows seen so far plus one when there is a next page. */
	totalItems: number;
	totalPages: number;
	items: HistoryRow[];
};

/** The replays page query (URL state) as a history request. */
export function historyInputFromQuery(
	query: ReplaysQuery,
	scope: 'user' | 'community',
	perPage: number
): HistoryListInput {
	const numbers = (values: string[]) => values.map(Number).filter(Number.isFinite);
	const ast = query.filter ? filterAstSchema.safeParse(query.filter) : null;
	return {
		scope,
		page: query.page,
		perPage,
		filter: ast?.success
			? ast.data
			: flatParamsToAst({
					ranked: query.ranked,
					pro: query.pro,
					playerIds: numbers(query.playerIds),
					maps: query.maps,
					races: numbers(query.races),
					slots: numbers(query.positions),
					matchtypes: matchtypesForMatchups(query.matchups),
					elo: query.elo ?? undefined,
					durationSeconds: query.duration
						? { op: query.duration.op, value: query.duration.value * 60 }
						: undefined
				}),
		includeSkirmish: false,
		sort: query.sort,
		sortDir: query.sortDir
	};
}

const COMMUNITY_COUNT_TTL = 300;
const PB_MAX_PER_PAGE = 500;

type SortEntry = { id: string; createdAt: string; value: number };
const signInError = () => unauthorized('Sign in to see your matches');

type Player = { profile_id: number; alias: string };

function sortOrder(input: HistoryListInput, prefix = '') {
	const direction = input.sortDir === 'asc' ? '' : '-';
	// Ties on a counter show the newest match first, whatever the direction.
	return input.sort === 'createdAt'
		? `${direction}${prefix}createdAt`
		: `${direction}${prefix}${input.sort},-${prefix}createdAt`;
}

function compareEntries(input: HistoryListInput) {
	const sign = input.sortDir === 'asc' ? 1 : -1;
	return (a: SortEntry, b: SortEntry) => {
		if (input.sort === 'createdAt') {
			return sign * a.createdAt.localeCompare(b.createdAt);
		}

		return sign * (a.value - b.value) || b.createdAt.localeCompare(a.createdAt);
	};
}

export class MatchHistoryService extends Service {
	private get lobbies() {
		return this.pb.collection('lobbies');
	}

	private get index() {
		return this.pb.collection('lobby_player_index');
	}

	private steamIdsOf(userId: string): Task<string[]> {
		return fromPb(
			this.pb.collection('users').getOne<{ steamIds: unknown }>(userId, { fields: 'steamIds' }),
			'User not found'
		).map((user) =>
			Array.isArray(user.steamIds)
				? user.steamIds.map(String).filter((id) => /^\d{10,}$/.test(id))
				: []
		);
	}

	private scopeFor(input: HistoryListInput, viewer: HistoryViewer): Task<HistoryScope> {
		const includeHidden = !!viewer?.isStaff;
		if (input.scope === 'community') {
			return okAsync({ kind: 'community', includeHidden, includeSkirmish: input.includeSkirmish });
		}

		if (!viewer) {
			return errAsync(signInError());
		}

		return this.steamIdsOf(viewer.id).map(
			(steamIds): HistoryScope => ({
				kind: 'user',
				userId: viewer.id,
				steamIds,
				profileIds: input.profileId ? [input.profileId] : [],
				includeHidden,
				includeSkirmish: input.includeSkirmish
			})
		);
	}

	private count(collection: 'lobbies' | 'lobby_player_index', filter: string): Task<number> {
		return fromPb(
			this.pb.collection(collection).getList(1, 1, { filter, fields: 'id' }),
			'Could not count matches'
		).map(({ totalItems }) => totalItems);
	}

	/** The first `n` records of a sorted list, paging past PocketBase's per-page cap. */
	private firstN<T>(
		collection: string,
		n: number,
		options: Record<string, unknown>,
		page = 1,
		items: T[] = []
	): Task<T[]> {
		const perPage = Math.min(PB_MAX_PER_PAGE, n);
		return fromPb(
			this.pb.collection(collection).getList<T>(page, perPage, { ...options, skipTotal: true }),
			'Could not load matches'
		).andThen((batch) => {
			const all = [...items, ...batch.items];
			return all.length < n && batch.items.length === perPage
				? this.firstN(collection, n, options, page + 1, all)
				: okAsync(all.slice(0, n));
		});
	}

	private recordsByIds(ids: string[]): Task<LobbyListRecord[]> {
		if (ids.length === 0) {
			return okAsync([]);
		}

		const order = new Map(ids.map((id, i) => [id, i]));
		return fromPb(
			this.lobbies.getFullList<LobbyListRecord>({
				filter: ids.map((id) => this.pb.filter('id = {:id}', { id })).join(' || '),
				fields: HISTORY_ROW_FIELDS
			}),
			'Could not load matches'
		).map((records) => records.sort((a, b) => order.get(a.id)! - order.get(b.id)!));
	}

	private lobbyIdsOf(indexFilter: string): Task<string[]> {
		return fromPb(
			this.index.getFullList<{ lobby: string }>({
				filter: indexFilter,
				fields: 'lobby',
				batch: 1000
			}),
			'Could not load matches'
		).map((rows) => [...new Set(rows.map((row) => row.lobby))]);
	}

	/** Community (or any single lobbies filter): one page query plus a count or next-page probe. */
	private listLobbies(
		filter: string,
		input: HistoryListInput,
		scope: HistoryScope,
		unfiltered: boolean
	): Task<{ records: LobbyListRecord[]; total: number }> {
		const offset = (input.page - 1) * input.perPage;
		const page = fromPb(
			this.lobbies.getList<LobbyListRecord>(input.page, input.perPage, {
				filter,
				sort: sortOrder(input),
				fields: HISTORY_ROW_FIELDS,
				skipTotal: true
			}),
			'Could not load matches'
		);
		const next: Task<number | null> = unfiltered
			? scope.kind === 'community' && !scope.includeHidden
				? cached(`history:community-total:${scope.includeSkirmish}`, COMMUNITY_COUNT_TTL, () =>
						this.count('lobbies', filter)
					)
				: this.count('lobbies', filter)
			: // one row past this page tells whether there is a next one
				fromPb(
					this.lobbies.getList(offset + input.perPage + 1, 1, {
						filter,
						sort: sortOrder(input),
						fields: 'id',
						skipTotal: true
					}),
					'Could not load matches'
				).map((probe) => (probe.items.length > 0 ? offset + input.perPage + 1 : null));
		return ResultAsync.combine([page, next]).map(([page, next]) => ({
			records: page.items,
			total: unfiltered ? (next as number) : (next ?? offset + page.items.length)
		}));
	}

	/** Sort keys of the user's played and uploaded games, merged and deduplicated. */
	private userGameEntries(
		played: string | null,
		uploaded: string | null,
		input: HistoryListInput
	): Task<SortEntry[]> {
		const want = (input.page - 1) * input.perPage + input.perPage + 1;
		const key = input.sort;
		return ResultAsync.combine([
			played
				? this.firstN<{ lobby: string; expand?: { lobby?: Record<string, unknown> } }>(
						'lobby_player_index',
						want,
						{
							filter: played,
							sort: sortOrder(input, 'lobby.'),
							expand: 'lobby',
							fields: `lobby,expand.lobby.createdAt,expand.lobby.${key}`
						}
					).map((rows) =>
						rows.map(
							(row): SortEntry => ({
								id: row.lobby,
								createdAt: String(row.expand?.lobby?.createdAt ?? ''),
								value: Number(row.expand?.lobby?.[key] ?? 0)
							})
						)
					)
				: okAsync<SortEntry[]>([]),
			uploaded
				? this.firstN<Record<string, unknown>>('lobbies', want, {
						filter: uploaded,
						sort: sortOrder(input),
						fields: `id,createdAt,${key}`
					}).map((rows) =>
						rows.map(
							(row): SortEntry => ({
								id: String(row.id),
								createdAt: String(row.createdAt),
								value: Number(row[key] ?? 0)
							})
						)
					)
				: okAsync<SortEntry[]>([])
		]).map(([playedEntries, uploadedEntries]) => {
			const seen = new Set<string>();
			return [...playedEntries, ...uploadedEntries]
				.sort(compareEntries(input))
				.filter((entry) => !seen.has(entry.id) && seen.add(entry.id));
		});
	}

	/** played + uploaded - both (a game the user uploaded and played counts once). */
	private userGameCount(played: string | null, uploaded: string | null, userId: string) {
		return ResultAsync.combine([
			played ? this.count('lobby_player_index', played) : okAsync(0),
			uploaded ? this.count('lobbies', uploaded) : okAsync(0),
			played
				? this.count(
						'lobby_player_index',
						`${played} && lobby.user = ${this.pb.filter('{:id}', { id: userId })}`
					)
				: okAsync(0)
		]).map(([playedCount, uploadedCount, bothCount]) => playedCount + uploadedCount - bothCount);
	}

	/**
	 * User scope: games played (from the user's own index rows) merged with games
	 * uploaded, each sorted by PocketBase, deduplicated here.
	 */
	private listUserGames(
		played: string | null,
		uploaded: string | null,
		input: HistoryListInput,
		unfiltered: boolean,
		userId: string
	): Task<{ records: LobbyListRecord[]; total: number }> {
		const offset = (input.page - 1) * input.perPage;
		return this.userGameEntries(played, uploaded, input).andThen((merged) => {
			const window = merged.slice(offset, offset + input.perPage);
			const seen = offset + window.length + (merged.length > offset + input.perPage ? 1 : 0);
			return ResultAsync.combine([
				this.recordsByIds(window.map((entry) => entry.id)),
				unfiltered ? this.userGameCount(played, uploaded, userId) : okAsync(seen)
			]).map(([records, total]) => ({ records, total }));
		});
	}

	/** Lobby ids for each index-filter group of the plan, rendered into the final filters. */
	private renderPlan(plan: ReturnType<typeof planHistoryQuery>) {
		return ResultAsync.combine(
			plan.groups.map((group) =>
				this.lobbyIdsOf(group.filter).map((ids): [number, string[]] => [group.index, ids])
			)
		).andThen((groups) => {
			try {
				return ok(plan.render(new Map(groups)));
			} catch (error) {
				if (error instanceof TooManyMatchesError) {
					return err(badRequest(error.message));
				}

				throw error;
			}
		});
	}

	list(input: HistoryListInput, viewer: HistoryViewer): Task<HistoryPage> {
		return this.scopeFor(input, viewer).andThen((scope) => {
			const plan = planHistoryQuery(input.filter, scope);
			return this.renderPlan(plan)
				.andThen((filters) =>
					filters.kind === 'lobbies'
						? this.listLobbies(filters.filter, input, scope, plan.unfiltered)
						: this.listUserGames(
								filters.played,
								filters.uploaded,
								input,
								plan.unfiltered,
								scope.kind === 'user' ? scope.userId : ''
							)
				)
				.andThen(({ records, total }) => {
					const rows = records.map(toHistoryRow);
					return this.loadRawPlayers(rowsNeedingRawPlayers(rows)).map((raw) => {
						attachPlayerStats(rows, raw);
						return {
							page: input.page,
							perPage: input.perPage,
							totalItems: total,
							totalPages: total > 0 ? Math.ceil(total / input.perPage) : 0,
							items: rows
						};
					});
				});
		});
	}

	private loadRawPlayers(ids: string[]): Task<Map<string, RawLobby>> {
		if (ids.length === 0) {
			return okAsync(new Map());
		}

		return fromPb(
			this.lobbies.getFullList<RawLobby>({
				filter: ids.map((id) => this.pb.filter('id = {:id}', { id })).join(' || '),
				fields: 'id,players,result,isRanked'
			}),
			'Could not load matches'
		).map((records) => new Map(records.map((record) => [record.id, record])));
	}

	/** Filter for the user's games on `lobby_player_index`, where the root row is any player. */
	private userGamesFilter(userId: string): Task<string> {
		return this.steamIdsOf(userId).map((steamIds) => {
			const played = steamIds.map((steamId) =>
				this.pb.filter('lobby.lobby_player_index_via_lobby.steam_id ?= {:steamId}', { steamId })
			);
			const mine = [this.pb.filter('lobby_user = {:userId}', { userId }), ...played].join(' || ');
			return `(${mine}) && counts = true`;
		});
	}

	/** Every map name in scope: all finished games, or the user's. */
	private mapsIn(scope: 'user' | 'community', viewer: HistoryViewer): Task<string[]> {
		if (scope === 'community') {
			return cached('history:maps', 600, () =>
				fromPb(
					this.pb
						.collection('history_maps')
						.getFullList<{ map: string }>({ fields: 'map' })
						.then((rows) => rows.map((row) => row.map)),
					'Could not load maps'
				)
			);
		}

		if (!viewer) {
			return errAsync(signInError());
		}

		// Index rows of games the user uploaded or played in; `counts` = finished, not Skirmish.
		return this.steamIdsOf(viewer.id)
			.andThen((steamIds) => {
				const mine = [
					this.pb.filter('lobby_user = {:id}', { id: viewer.id }),
					...steamIds.map((steamId) => this.pb.filter('steam_id = {:steamId}', { steamId }))
				];
				return fromPb(
					this.index.getFullList<{ map: string }>({
						filter: `(${mine.join(' || ')}) && counts = true`,
						fields: 'map',
						batch: 1000
					}),
					'Could not load maps'
				);
			})
			.map((rows) => [...new Set(rows.map((row) => row.map).filter(Boolean))]);
	}

	/** Maps for the history filter: all finished games, or the user's. */
	searchMaps(
		scope: 'user' | 'community',
		q: string,
		limit: number,
		viewer: HistoryViewer
	): Task<{ map: string; name: string }[]> {
		const needle = q.trim().toLowerCase();
		return this.mapsIn(scope, viewer).map((maps) =>
			maps
				.map((map) => ({ map, name: mapDisplayName(map) }))
				.filter(
					(entry) =>
						!needle ||
						entry.name.toLowerCase().includes(needle) ||
						entry.map.toLowerCase().includes(needle)
				)
				.sort((a, b) => a.name.localeCompare(b.name) || a.map.localeCompare(b.map))
				.slice(0, limit)
		);
	}

	/** Distinct players (sorted by alias) in the index rows matching `filter`, up to `limit`. */
	private distinctPlayers(
		filter: string,
		limit: number,
		page = 1,
		players = new Map<number, string>()
	): Task<Map<number, string>> {
		return fromPb(
			this.index.getList<Player>(page, PB_MAX_PER_PAGE, {
				filter,
				sort: 'alias,profile_id',
				fields: 'profile_id,alias',
				skipTotal: true
			}),
			'Could not search players'
		).andThen((rows) => {
			for (const row of rows.items) {
				if (players.size < limit && !players.has(row.profile_id)) {
					players.set(row.profile_id, row.alias);
				}
			}
			const more = rows.items.length === PB_MAX_PER_PAGE && players.size < limit && page < 10;
			return more ? this.distinctPlayers(filter, limit, page + 1, players) : okAsync(players);
		});
	}

	/** Players for the history filter: everyone seen in finished games, or in the user's games. */
	searchPlayers(
		scope: 'user' | 'community',
		q: string,
		limit: number,
		viewer: HistoryViewer
	): Task<Player[]> {
		const needle = q.trim();
		const catalog = this.pb.collection('history_players');

		if (scope === 'community') {
			// `aliases` holds every name a player used; `alias` is their latest.
			return fromPb(
				catalog.getList<Player>(1, limit, {
					filter: needle
						? this.pb.filter('(aliases ~ {:q} || profile_id ~ {:q})', { q: needle })
						: '',
					sort: 'alias,profile_id',
					fields: 'profile_id,alias',
					skipTotal: true
				}),
				'Could not search players'
			).map((rows) => rows.items.map((row) => ({ profile_id: row.profile_id, alias: row.alias })));
		}

		if (!viewer) {
			return errAsync(signInError());
		}

		// One index row per player per game: page through (sorted by alias) until enough distinct players.
		const search = needle
			? this.pb.filter('(alias ~ {:q} || profile_id ~ {:q})', { q: needle })
			: '';
		return this.userGamesFilter(viewer.id)
			.andThen((games) => this.distinctPlayers([games, search].filter(Boolean).join(' && '), limit))
			.andThen((players) => {
				if (players.size === 0) {
					return okAsync<Player[]>([]);
				}

				// Show each player's latest name, as in community search.
				return fromPb(
					catalog.getFullList<Player>({
						filter: [...players.keys()]
							.map((id) => this.pb.filter('id = {:id}', { id: String(id) }))
							.join(' || '),
						fields: 'profile_id,alias'
					}),
					'Could not search players'
				).map((latest) => {
					const latestById = new Map(latest.map((row) => [row.profile_id, row.alias]));
					return [...players].map(([profile_id, alias]) => ({
						profile_id,
						alias: latestById.get(profile_id) ?? alias
					}));
				});
			});
	}

	/** Every player in the user's games, with the name they used last. */
	private userPlayers(userId: string): Task<Player[]> {
		return this.userGamesFilter(userId)
			.andThen((filter) =>
				fromPb(
					// Newest game first, so each player keeps the name they used last.
					this.index.getFullList<Player>({
						filter,
						sort: '-session_id',
						fields: 'profile_id,alias',
						batch: 1000
					}),
					'Could not load players'
				)
			)
			.map((rows) => {
				const players = new Map<number, string>();
				for (const row of rows) {
					if (!players.has(row.profile_id)) {
						players.set(row.profile_id, row.alias);
					}
				}
				return [...players]
					.map(([profile_id, alias]) => ({ profile_id, alias }))
					.sort((a, b) => a.alias.localeCompare(b.alias) || a.profile_id - b.profile_id);
			});
	}

	/** Every map and player for the desktop app's filter pickers (community, or the user's games). */
	filterOptions(
		scope: 'user' | 'community',
		viewer: HistoryViewer
	): Task<{ maps: string[]; players: Player[] }> {
		const players =
			scope === 'user' && viewer
				? this.userPlayers(viewer.id)
				: fromPb(
						this.pb.collection('history_players').getFullList<Player>({
							sort: 'alias,profile_id',
							fields: 'profile_id,alias',
							batch: 1000
						}),
						'Could not load players'
					).map((rows) => rows.map((row) => ({ profile_id: row.profile_id, alias: row.alias })));
		return ResultAsync.combine([
			this.searchMaps(scope, '', Number.MAX_SAFE_INTEGER, viewer),
			players
		]).map(([maps, players]) => ({ maps: maps.map((entry) => entry.map), players }));
	}
}
