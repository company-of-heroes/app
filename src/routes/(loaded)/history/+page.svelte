<script lang="ts">
	import type { LobbyAggregationResponse } from '$core/pocketbase/types';
	import type { LobbyPlayer } from '@fknoobs/app';
	import { app } from '$core/context';
	import { H } from '$lib/components/ui/h';
	import { normalizeMapName } from '$lib/utils';
	import { resource } from 'runed';
	import { uniqBy, uniq } from 'lodash-es';
	import { MatchList, type MatchListState } from './match-list.svelte';
	import MatchFilters from './match-filters.svelte';
	import MatchTable from './match-table.svelte';
	import type { Snapshot } from './$types';

	let list = $state(new MatchList());

	$effect(() => {
		if (list.matches.length === 0) {
			list.loadMore();
		}
	});

	const aggregation = resource(
		() => list.filters.scope,
		async () => {
			const response = await app.pocketbase
				.collection(
					list.filters.scope === 'user' ? 'lobby_aggregation' : 'lobby_aggregation_community'
				)
				.getFullList<LobbyAggregationResponse<string[], LobbyPlayer[]>>({
					filter: list.filters.scope === 'user' ? `user = "${app.features.auth.userId}"` : undefined
				});

			if (response.length === 0) {
				return { players: [], maps: [] };
			}

			return {
				players: uniqBy(response[0].players, 'profile.alias').filter((p) => p.profile),
				maps: uniq(response[0].maps)
			};
		}
	);

	const mapsList = $derived(
		aggregation.current?.maps.map((m) => ({
			value: m,
			label: normalizeMapName(m)
		})) || []
	);

	const playersList = $derived(
		aggregation.current?.players.map((p) => ({
			value: p.profile!.alias,
			label: p.profile!.alias
		})) || []
	);

	export const snapshot: Snapshot<MatchListState> = {
		capture: () => list.capture(),
		restore: (value) => {
			list.restore(value);
		}
	};
</script>

<H level="1">Match History</H>

<MatchFilters {list} {mapsList} {playersList} />
<MatchTable {list} />
