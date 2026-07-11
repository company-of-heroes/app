<script lang="ts">
	import type { Snapshot } from './$types';
	import { app } from '$core/app/context';
	import { H } from '$lib/components/ui/h';
	import { getString } from '$lib/utils/game';
	import { resource } from 'runed';
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
		() => app.features.auth.userId,
		async () => {
			const response = await app.pocketbase.send<{
				maps: string[];
				players: { name: string }[];
			}>('/api/replay-filters', {
				method: 'GET',
				query: { userId: app.features.auth.userId }
			});

			return {
				players: response.players ?? [],
				maps: response.maps ?? []
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

<ReplayFilters bind:list {mapsList} {playersList} />
<ReplayTable {list} />
