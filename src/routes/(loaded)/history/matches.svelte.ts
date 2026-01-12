import { useQuery } from '$core/app/cache';
import { app } from '$core/app/context';
import { resource, watch, type ResourceReturn } from 'runed';
import { compact, isEqual, map } from 'lodash-es';
import type {
	MatchAggregationCommunityResponse,
	MatchAggregationResponse,
	MatchesResponse
} from '$core/pocketbase/types';
import type { ListResult } from 'pocketbase';
import type { AggregationPlayer, MatchExpanded } from '$core/app/database/matches';
import { md5, normalizeMapName } from '$lib/utils';

export type MatchesFilterState = {
	playerIds?: string[];
	maps?: string[];
};

export class Matches {
	public scope: 'user' | 'community' = $state('community');
	public page = $state(1);
	public perPage = $state(50);

	public aggregation =
		$state<
			ResourceReturn<
				| MatchAggregationResponse<string[], AggregationPlayer[], string>
				| MatchAggregationCommunityResponse<string[], AggregationPlayer[], string[]>
			>
		>()!;

	public matches = $state<ResourceReturn<ListResult<MatchExpanded>>>()!;

	public filters = $state<MatchesFilterState>({
		playerIds: undefined,
		maps: undefined
	});

	constructor() {
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
		this.matches = resource(
			() => [this.scope, this.filter],
			() => {
				return useQuery(md5(this.filter), {
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

	get players() {
		return map(this.aggregation.current?.players || [], (p) => {
			return {
				label: p.alias,
				value: p.profile_id.toString()
			};
		});
	}

	get maps() {
		return map(this.aggregation.current?.maps || [], (m) => ({
			label: normalizeMapName(m),
			value: m
		}));
	}

	get filter() {
		const { user } = app.features.auth;
		const { playerIds, maps } = this.filters;

		const participantQueries = compact([
			this.scope === 'user' &&
				user.steamIds.map((id) => `players ~ '\"steamId\":\"${id}\"'`).join(' || '),
			playerIds?.length && playerIds.map((id) => `players ~ '\"profile_id\":${id}'`).join(' && ')
		]);

		const mapQueries = maps?.length && maps.map((map) => `map = '${map}'`).join(' || ');

		return compact([
			'needsResult = false',
			participantQueries.length && `(${participantQueries.join(' || ')})`,
			mapQueries && `(${mapQueries})`
		]).join(' && ');
	}
}
