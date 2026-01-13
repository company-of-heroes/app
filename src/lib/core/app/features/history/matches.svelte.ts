import { useQuery } from '$core/app/cache';
import { app } from '$core/app/context';
import { resource, watch, type ResourceReturn } from 'runed';
import { compact, isEqual, map, join } from 'lodash-es';
import type {
	MatchAggregationCommunityResponse,
	MatchAggregationResponse
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
				| MatchAggregationResponse<string[], AggregationPlayer[], string>
				| MatchAggregationCommunityResponse<string[], AggregationPlayer[], string[]>
			>
		>()!;

	public result = $state<ResourceReturn<ListResult<MatchExpanded>>>()!;

	public filters = $state<MatchesFilterState>({
		playerIds: undefined,
		maps: undefined,
		ranked: false
	});

	public players = $derived.by(() => {
		return map(this.aggregation.current?.players || [], (p) => {
			return {
				label: p.alias,
				value: p.profile_id.toString()
			};
		});
	});

	public maps = $derived.by(() => {
		return map(this.aggregation.current?.maps || [], (m) => ({
			label: normalizeMapName(m),
			value: m
		}));
	});

	public filter = $derived.by(() => {
		const { user } = app.features.auth;
		const { playerIds, maps } = this.filters;
		const filter: string[] = [];

		if (this.scope === 'user' && user.steamIds.length > 0) {
			filter.push(
				join(
					map(user.steamIds, (id) => `players ~ '\"steamId\":\"${id}\"'`),
					' || '
				)
			);
		}

		const participantQueries = compact([
			this.scope === 'user' &&
				user.steamIds.map((id) => `players ~ '\"steamId\":\"${id}\"'`).join(' || '),
			playerIds?.length && playerIds.map((id) => `players ~ '\"profile_id\":${id}'`).join(' && ')
		]);

		const mapQueries = maps?.length && maps.map((map) => `map = '${map}'`).join(' || ');

		return compact([
			'needsResult = false',
			this.filters.ranked && 'isRanked = true',
			participantQueries.length && `(${participantQueries.join(' || ')})`,
			mapQueries && `(${mapQueries})`
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
					invalidateFn: async (value) => {
						const response = await this.getAggregation();

						if (isEqual(value, response)) {
							return false;
						}

						return true;
					}
				});
			}
		);
		this.result = resource(
			() => [this.scope, this.filter, this.page],
			() => {
				return useQuery(md5(this.filter + '-' + this.page), {
					queryFn: () => this.getMatches(),
					invalidateFn: async (value) => {
						const response = await this.getMatches();

						if (isEqual(value, response)) {
							return false;
						}

						return true;
					}
				});
			}
		);
	}

	getMatches() {
		return app.database.matches.getPaginated(this.page, this.perPage, {
			filter: this.filter,
			sort: '-createdAt'
		});
	}

	getAggregation() {
		return app.database.matches.getMatchAggregation(
			this.scope,
			this.scope === 'user' ? app.features.auth.user.id : undefined
		);
	}
}
