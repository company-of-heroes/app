import { useQuery } from '$core/app/cache';
import { app } from '$core/app/context';
import { resource, watch, type ResourceReturn } from 'runed';
import { compact, map, join, uniqBy } from 'lodash-es';
import type {
	LobbyAggregationResponse,
	LobbyAggregationCommunityResponse
} from '$core/pocketbase/types';
import type { ListResult } from 'pocketbase';
import type { AggregationPlayer, MatchExpanded } from '$core/app/database/matches';
import { md5, normalizeMapName } from '$lib/utils';

export type MatchesFilterState = {
	playerIds?: string[];
	maps?: string[];
	ranked?: boolean;
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
		this.filters = {
			playerIds: undefined,
			maps: undefined,
			ranked: false
		};
	}
	public page = $state(1);
	public perPage = $state(50);

	public aggregation =
		$state<
			ResourceReturn<
				| LobbyAggregationResponse<string, string[], AggregationPlayer[]>
				| LobbyAggregationCommunityResponse<string[], AggregationPlayer[], string[]>
			>
		>()!;

	public result = $state<ResourceReturn<ListResult<MatchExpanded>>>()!;

	public filters = $state<MatchesFilterState>({
		playerIds: undefined,
		maps: undefined,
		ranked: false
	});

	public players = $derived.by(() => {
		return uniqBy(
			map(this.aggregation.current?.players || [], (p) => {
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
		return map(this.aggregation.current?.maps || [], (m) => ({
			label: normalizeMapName(m),
			value: m
		}));
	});

	public filter = $derived.by(() => {
		const { playerIds, maps } = this.filters;

		return compact([
			'needsResult = false',
			'title != "Skirmish"',
			this.scope === 'community' && `replay != ""`,
			this.filters.ranked && `isRanked = true`,
			this.scope === 'user' && `user = "${app.features.auth.userId}"`,
			playerIds?.length &&
				'(' +
					join(
						map(playerIds, (id) => `players ~ '"profile_id":${id},'`),
						' || '
					) +
					')',
			maps?.length &&
				'(' +
					join(
						map(maps, (map) => `map = '${map}'`),
						' || '
					) +
					')',
		]).join(' && ');
	});

	constructor() {
		watch(
			() => $state.snapshot(this.filters),
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
			() => [this.scope, this.filter, this.page],
			() => {
				return this.getMatches();
			}
		);
	}

	getMatches() {
		const cacheKey = `matches-${md5(JSON.stringify({ scope: this.scope, filter: this.filter, page: this.page }))}`;

		return useQuery(cacheKey, {
			queryFn: () =>
				app.database.matches.getHistoryList(this.page, this.perPage, this.filter),
			ttl: 60
		});
	}

	getAggregation() {
		return app.database.matches.getMatchAggregation(
			this.scope,
			this.scope === 'user' ? app.features.auth.user.id : undefined
		);
	}
}
