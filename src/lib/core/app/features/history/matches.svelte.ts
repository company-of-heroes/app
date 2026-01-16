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
				// @ts-expect-error This is for backward compatibility until all types are fixed
				label: 'profile' in p ? p.profile!.alias! : p.alias,
				// @ts-expect-error This is for backward compatibility until all types are fixed
				value: 'profile' in p ? p.profile!.profile_id!.toString() : p.profile_id?.toString()
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

		return compact([
			'needsResult = false',
			this.filters.ranked && `isRanked = true`,
			/**
			 * Add user steam ID's if in user scope
			 */
			this.scope === 'user' &&
				join(
					map(user.steamIds, (id) => `players ~ '\"steamId\":\"${id}\"'`),
					' || '
				),
			/**
			 * Add player ID's if any are selected
			 */
			join(
				map(playerIds, (id) => `players ~ '\"profile_id\":${id}'`),
				' || '
			),
			/**
			 * Add map filters if any are selected
			 */
			join(
				map(maps, (map) => `map = '${map}'`),
				' || '
			)
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
					invalidateFn: async (value) => isEqual(value, await this.getAggregation())
				});
			}
		);
		this.result = resource(
			() => [this.scope, this.filter, this.page],
			() => {
				return useQuery(md5(this.filter + '-' + this.page), {
					queryFn: () => this.getMatches(),
					invalidateFn: async (value) => isEqual(value, await this.getMatches())
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
