<script lang="ts">
	import type { ReplayAggregationResponse } from '$core/pocketbase/types';
	import type { Player } from '@fknoobs/replay-parser';
	import type { Snapshot } from './$types';
	import { app } from '$core/context';
	import { H } from '$lib/components/ui/h';
	import { getString } from '$lib/utils/game';
	import { resource } from 'runed';
	import { uniqBy, uniq } from 'lodash-es';
	import { ReplayList, type ReplayListState } from './replay-list.svelte';
	import ReplayFilters from './replay-filters.svelte';
	import ReplayTable from './replay-table.svelte';

	let list = $state(new ReplayList());

	$effect(() => {
		if (list.replays.length === 0) {
			list.loadMore();
		}
	});

	const aggregation = resource(
		() => null,
		async () => {
			const response = await app.pocketbase
				.collection('replay_aggregation')
				.getFullList<ReplayAggregationResponse<string[], Player[]>>();

			if (response.length === 0) {
				return { players: [], maps: [] };
			}

			// Aggregate across all users
			const allPlayers = response.flatMap((r) => r.players || []);
			const allMaps = response.flatMap((r) => r.maps || []);

			return {
				players: uniqBy(allPlayers, 'name'),
				maps: uniq(allMaps)
			};
		}
	);

	const mapsList = $derived(
		aggregation.current?.maps.map((m) => ({
			value: m,
			label: getString(m) || m
		})) || []
	);

	const playersList = $derived(
		aggregation.current?.players.map((p) => ({
			value: p.name,
			label: p.name
		})) || []
	);

	export const snapshot: Snapshot<ReplayListState> = {
		capture: () => list.capture(),
		restore: (value) => {
			list.restore(value);
		}
	};
</script>

<H level="1" class="mb-8">Replays</H>

<ReplayFilters {list} {mapsList} {playersList} />
<ReplayTable {list} />
