import { useQuery } from '$core/app/cache';
import { app } from '$core/app/context';
import { Debounced, resource, watch, type ResourceReturn } from 'runed';
import type { ListResult } from 'pocketbase';
import type {
	FilterOperator,
	HistoryListQuery,
	HistorySortField,
	MatchExpanded
} from '$core/app/database/matches';
import type { FilterAst } from '@company-of-heroes/ui/replay';
import { md5 } from '$lib/utils';
import { dev } from '$app/environment';

const FILTER_DEBOUNCE_MS = 200;

export type CompareFilter = {
	op: FilterOperator;
	value: number;
};

export type HistoryMatchup = '1v1' | '2v2' | '3v3' | '4v4';

/** Automatch + AT matchtype ids for 1v1–4v4 history filters. */
export const HISTORY_MATCHUP_TYPES: Record<HistoryMatchup, readonly number[]> = {
	'1v1': [1],
	'2v2': [2, 5],
	'3v3': [3, 6],
	'4v4': [4, 7]
};

export function matchtypesForMatchups(matchups: string[]): number[] {
	const ids = new Set<number>();
	for (const matchup of matchups) {
		const types = HISTORY_MATCHUP_TYPES[matchup as HistoryMatchup];
		if (!types) continue;
		for (const id of types) ids.add(id);
	}
	return [...ids];
}

/**
 * Starting lobby slots are 1-based (1–8 in 4v4).
 */
export function slotsForPositions(positions: string[]): number[] {
	const slots = new Set<number>();
	for (const value of positions) {
		const slot = Number(value);
		if (!Number.isInteger(slot) || slot < 1 || slot > 8) continue;
		slots.add(slot);
	}
	return [...slots];
}

export type MatchesFilterState = {
	playerIds: string[];
	maps: string[];
	races: string[];
	matchups: string[];
	positions: string[];
	ranked: boolean;
	pro: boolean;
	elo?: CompareFilter;
	duration?: CompareFilter;
	filter?: FilterAst | null;
};

const EMPTY_FILTERS: MatchesFilterState = {
	playerIds: [],
	maps: [],
	races: [],
	matchups: [],
	positions: [],
	ranked: false,
	pro: false,
	elo: undefined,
	duration: undefined,
	filter: undefined
};

export class Matches {
	private _scope = $state<'user' | 'community'>('user');

	public get scope() {
		return this._scope;
	}

	public set scope(value) {
		if (this._scope === value) {
			return;
		}

		this._scope = value;
		this.page = 1;
		this.#awaitingScopeFetch = true;
		this.filters = { ...EMPTY_FILTERS };
		this.sort = 'createdAt';
		this.sortDir = 'desc';
		this.playerOptions = [];
		this.mapOptions = [];
		this.#debouncedFilters.setImmediately($state.snapshot(this.filters));
	}

	/** Set scope without wiping filters (URL / snapshot hydrate). */
	public setScopePreservingFilters(value: 'user' | 'community') {
		if (this._scope === value) {
			return;
		}

		this._scope = value;
		this.#awaitingScopeFetch = true;
	}

	public applyListState(state: {
		page: number;
		sort: HistorySortField;
		sortDir: 'asc' | 'desc';
		filters: MatchesFilterState;
	}) {
		this.filters = {
			playerIds: [...state.filters.playerIds],
			maps: [...state.filters.maps],
			races: [...state.filters.races],
			matchups: [...state.filters.matchups],
			positions: [...state.filters.positions],
			ranked: state.filters.ranked,
			pro: state.filters.pro,
			elo: state.filters.elo ? { ...state.filters.elo } : undefined,
			duration: state.filters.duration ? { ...state.filters.duration } : undefined,
			filter: state.filters.filter ?? undefined
		};
		this.sort = state.sort;
		this.sortDir = state.sortDir;
		this.page = state.page;
		this.#debouncedFilters.setImmediately($state.snapshot(this.filters));
	}

	public capture(): {
		scope: 'user' | 'community';
		page: number;
		sort: HistorySortField;
		sortDir: 'asc' | 'desc';
		filters: MatchesFilterState;
		playerOptions: { label: string; value: string }[];
		mapOptions: { label: string; value: string }[];
	} {
		return {
			scope: this.scope,
			page: this.page,
			sort: this.sort,
			sortDir: this.sortDir,
			filters: {
				playerIds: [...this.filters.playerIds],
				maps: [...this.filters.maps],
				races: [...this.filters.races],
				matchups: [...this.filters.matchups],
				positions: [...this.filters.positions],
				ranked: this.filters.ranked,
				pro: this.filters.pro,
				elo: this.filters.elo ? { ...this.filters.elo } : undefined,
				duration: this.filters.duration ? { ...this.filters.duration } : undefined,
				filter: this.filters.filter ?? undefined
			},
			playerOptions: this.playerOptions.map((option) => ({ ...option })),
			mapOptions: this.mapOptions.map((option) => ({ ...option }))
		};
	}

	public restore(
		state: {
			scope: 'user' | 'community';
			page: number;
			sort: HistorySortField;
			sortDir: 'asc' | 'desc';
			filters: MatchesFilterState;
			playerOptions: { label: string; value: string }[];
			mapOptions: { label: string; value: string }[];
		} | null
	) {
		if (!state) {
			return;
		}

		this.setScopePreservingFilters(state.scope);
		this.applyListState(state);
		this.playerOptions = state.playerOptions.map((option) => ({ ...option }));
		this.mapOptions = state.mapOptions.map((option) => ({ ...option }));
	}

	public page = $state(1);
	public perPage = $state(15);

	public result = $state<ResourceReturn<ListResult<MatchExpanded>>>()!;

	public filters = $state<MatchesFilterState>({ ...EMPTY_FILTERS });
	public sort = $state<HistorySortField>('createdAt');
	public sortDir = $state<'asc' | 'desc'>('desc');
	public playerOptions = $state<{ label: string; value: string }[]>([]);
	public mapOptions = $state<{ label: string; value: string }[]>([]);

	#debouncedFilters: Debounced<MatchesFilterState>;
	#resultsByKey = $state<Record<string, ListResult<MatchExpanded>>>({});
	#loadedResultKey = $state<string | null>(null);
	#awaitingScopeFetch = $state(false);

	public resultKey = $derived.by(() =>
		md5(JSON.stringify({ ...this.query, page: this.page }))
	);

	public freshResult = $derived(
		this.#loadedResultKey === this.resultKey ? this.result.current : undefined
	);

	public displayedResult = $derived.by(() => {
		if (this.#awaitingScopeFetch) {
			return this.freshResult;
		}

		const cached = this.#resultsByKey[this.resultKey];

		if (this.result.loading) {
			return cached;
		}

		return this.freshResult ?? cached;
	});

	public tableLoading = $derived(
		!this.displayedResult && (this.result.loading || this.#awaitingScopeFetch)
	);

	public query = $derived.by((): HistoryListQuery => {
		const { playerIds, maps, races, matchups, positions, ranked, pro, elo, duration, filter } =
			this.#debouncedFilters.current;

		return {
			scope: this.scope,
			userId: this.scope === 'user' ? app.features.auth.userId : undefined,
			profileId:
				this.scope === 'user' ? (app.game.profile?.relic.profile_id ?? undefined) : undefined,
			ranked,
			pro,
			playerIds,
			maps,
			races,
			matchtypes: matchtypesForMatchups(matchups),
			slots: slotsForPositions(positions),
			includeSkirmish: dev,
			eloOp: elo?.op,
			elo: elo?.value != null ? Number(elo.value) : undefined,
			durationOp: duration?.op,
			duration: duration != null ? Number(duration.value) * 60 : undefined,
			filter: filter ?? undefined,
			sort: this.sort,
			sortDir: this.sortDir
		};
	});

	constructor() {
		this.#debouncedFilters = new Debounced(() => $state.snapshot(this.filters), FILTER_DEBOUNCE_MS);

		watch(
			() => $state.snapshot(this.#debouncedFilters.current),
			() => {
				this.page = 1;
			}
		);
		this.result = resource(
			() => [this.scope, this.query, this.page],
			(_values, _previousValues, { signal }) => {
				return this.getMatches(signal);
			}
		);

		watch(
			() => this.result.current,
			(current) => {
				if (!current) {
					return;
				}

				this.#loadedResultKey = this.resultKey;
				this.#resultsByKey[this.resultKey] = current;

				if (this.#awaitingScopeFetch) {
					this.#awaitingScopeFetch = false;
				}
			}
		);

		watch(
			() => [this.result.loading, this.result.error, this.resultKey] as const,
			([loading, error, key]) => {
				if (!this.#awaitingScopeFetch || loading) {
					return;
				}

				if (this.#loadedResultKey === key || error) {
					this.#awaitingScopeFetch = false;
				}
			}
		);
	}

	toggleSort(field: HistorySortField) {
		if (this.sort === field) {
			if (this.sortDir === 'desc') {
				this.sortDir = 'asc';
			} else {
				this.sort = 'createdAt';
				this.sortDir = 'desc';
			}
		} else {
			this.sort = field;
			this.sortDir = 'desc';
		}
		this.page = 1;
	}

	rememberPlayerOptions(options: { label: string; value: string }[]) {
		const byValue: Record<string, { label: string; value: string }> = {};
		for (const option of this.playerOptions) {
			byValue[option.value] = option;
		}
		for (const option of options) {
			byValue[option.value] = option;
		}
		this.playerOptions = Object.values(byValue);
	}

	rememberMapOptions(options: { label: string; value: string }[]) {
		const byValue: Record<string, { label: string; value: string }> = {};
		for (const option of this.mapOptions) {
			byValue[option.value] = option;
		}
		for (const option of options) {
			byValue[option.value] = option;
		}
		this.mapOptions = Object.values(byValue);
	}

	searchPlayers(q: string) {
		return app.database.matches
			.searchHistoryPlayers(
				this.scope,
				q,
				this.scope === 'user' ? app.features.auth.userId : undefined
			)
			.then((items) => {
				const options = items.map((player) => ({
					label: (player.alias || '').trim() || String(player.profile_id),
					value: String(player.profile_id)
				}));
				this.rememberPlayerOptions(options);
				return options;
			});
	}

	searchMaps(q: string) {
		return app.database.matches
			.searchHistoryMaps(
				this.scope,
				q,
				this.scope === 'user' ? app.features.auth.userId : undefined
			)
			.then((items) => {
				const options = items.map((item) => ({
					label: item.name || item.map,
					value: item.map
				}));
				this.rememberMapOptions(options);
				return options;
			});
	}

	getMatches(signal?: AbortSignal) {
		const hasFilters =
			this.query.filter != null ||
			(this.query.playerIds?.length ?? 0) > 0 ||
			(this.query.maps?.length ?? 0) > 0 ||
			(this.query.races?.length ?? 0) > 0 ||
			(this.query.matchtypes?.length ?? 0) > 0 ||
			(this.query.slots?.length ?? 0) > 0 ||
			this.query.ranked ||
			this.query.pro ||
			this.query.elo != null ||
			this.query.duration != null ||
			this.query.sort !== 'createdAt' ||
			this.query.sortDir === 'asc';
		const cacheKey = `matches-${md5(JSON.stringify({ ...this.query, page: this.page }))}`;

		if (this.scope === 'community') {
			return app.database.matches.getHistoryList(this.page, this.perPage, this.query, { signal });
		}

		return useQuery(cacheKey, {
			queryFn: () =>
				app.database.matches.getHistoryList(this.page, this.perPage, this.query, { signal }),
			ttl: hasFilters ? 15 : 60,
			signal
		});
	}
}
