import { useQuery } from '$core/app/cache';
import { app } from '$core/app/context';
import { Debounced, resource, watch, type ResourceReturn } from 'runed';
import { map, uniqBy } from 'lodash-es';
import type {
	LobbyAggregationResponse,
	LobbyAggregationCommunityResponse
} from '$core/pocketbase/types';
import type { ListResult } from 'pocketbase';
import type { AggregationPlayer, MatchExpanded } from '$core/app/database/matches';
import { md5, normalizeMapName } from '$lib/utils';

const FILTER_DEBOUNCE_MS = 200;

export type MatchesFilterState = {
	playerIds?: string[];
	maps?: string[];
	ranked?: boolean;
};

type MatchAggregation =
	| LobbyAggregationResponse<string, string[], AggregationPlayer[]>
	| LobbyAggregationCommunityResponse<string[], AggregationPlayer[], string[]>;

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
		this.filters = {
			playerIds: undefined,
			maps: undefined,
			ranked: false
		};
		this.#debouncedFilters.setImmediately($state.snapshot(this.filters));
	}
	public page = $state(1);
	public perPage = $state(15);

	public aggregation = $state<ResourceReturn<MatchAggregation>>()!;

	public result = $state<ResourceReturn<ListResult<MatchExpanded>>>()!;

	public filters = $state<MatchesFilterState>({
		playerIds: undefined,
		maps: undefined,
		ranked: false
	});

	#debouncedFilters: Debounced<MatchesFilterState>;
	#resultsByKey = $state<Record<string, ListResult<MatchExpanded>>>({});
	#aggregationByScope = $state<Partial<Record<'user' | 'community', MatchAggregation>>>({});
	#loadedResultKey = $state<string | null>(null);
	#loadedAggregationScope = $state<'user' | 'community' | null>(null);
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

	public displayedAggregation = $derived.by(() => {
		const cached = this.#aggregationByScope[this.scope];
		const current =
			this.#loadedAggregationScope === this.scope ? this.aggregation.current : undefined;

		if (this.aggregation.loading) {
			return cached;
		}

		return current ?? cached;
	});

	public players = $derived.by(() => {
		return uniqBy(
			map(this.displayedAggregation?.players || [], (p) => {
				return {
					// @ts-expect-error This is for backward compatibility until all types are fixed
					label: 'profile' in p ? p.profile!.alias! : p.alias,
					// @ts-expect-error This is for backward compatibility until all types are fixed
					value: 'profile' in p ? p.profile!.profile_id!.toString() : p.profile_id?.toString()
				};
			}),
			'value'
		);
	});

	public maps = $derived.by(() => {
		return map(this.displayedAggregation?.maps || [], (m) => ({
			label: normalizeMapName(m),
			value: m
		}));
	});

	public query = $derived.by(() => {
		const { playerIds, maps, ranked } = this.#debouncedFilters.current;

		return {
			scope: this.scope,
			userId: this.scope === 'user' ? app.features.auth.userId : undefined,
			ranked: ranked ?? false,
			playerIds: playerIds ?? [],
			maps: maps ?? []
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
		this.aggregation = resource(
			() => this.scope,
			() => {
				return useQuery('matches-aggregation-' + this.scope, {
					queryFn: () => this.getAggregation(),
					ttl: 300
				});
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

		watch(
			() => this.aggregation.current,
			(current) => {
				if (!current) {
					return;
				}

				this.#loadedAggregationScope = this.scope;
				this.#aggregationByScope[this.scope] = current;
			}
		);
	}

	getMatches(signal?: AbortSignal) {
		const hasFilters =
			this.query.playerIds.length > 0 || this.query.maps.length > 0 || this.query.ranked;
		const cacheKey = `matches-${md5(JSON.stringify({ ...this.query, page: this.page }))}`;

		return useQuery(cacheKey, {
			queryFn: () =>
				app.database.matches.getHistoryList(this.page, this.perPage, this.query, { signal }),
			ttl: hasFilters ? undefined : 60,
			signal
		});
	}

	getAggregation() {
		return app.database.matches.getMatchAggregation(
			this.scope,
			this.scope === 'user' ? app.features.auth.user.id : undefined
		);
	}
}
