<script lang="ts">
	import type { ReplayAggregationResponse } from '$core/pocketbase/types';
	import type { ReplaysExpanded } from '$core/app/database/replays';
	import type { Player } from '@fknoobs/replay-parser';
	import * as Form from '$lib/components/ui/form';
	import { app } from '$core/app';
	import { tooltip } from '$lib/attachments';
	import { H } from '$lib/components/ui/h';
	import { Table, TD, TH, THead, TR } from '$lib/components/ui/table';
	import { cn, getFactionFlagFromRace } from '$lib/utils';
	import { getString } from '$lib/utils/game';
	import { resource, watch, Debounced } from 'runed';
	import { uniqBy, uniq } from 'lodash-es';
	import { Input, Selection } from '$lib/components/ui/input';
	import Checkbox from '$lib/components/ui/input/checkbox.svelte';
	import dayjs from '$lib/dayjs';

	const PAGE_SIZE = 50;
	const FILTER_DEBOUNCE_MS = 300;

	type FiltersState = {
		query: string;
		players: string[];
		maps: string[];
		ranked: { value: boolean; indeterminate: boolean };
		vp: { value: boolean; indeterminate: boolean };
		highResources: { value: boolean; indeterminate: boolean };
	};

	function escapePocketBaseString(value: string) {
		return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	}

	function buildPocketBaseFilter(filters: FiltersState) {
		const parts: string[] = [`createdBy = "${app.features.auth.userId}"`];

		const query = filters.query.trim();
		if (query) {
			const q = escapePocketBaseString(query);
			parts.push(`title ~ "${q}"`);
		}

		if (filters.ranked.value) parts.push('isRanked = true');
		else if (filters.ranked.indeterminate) parts.push('isRanked = false');

		if (filters.vp.value) parts.push('isVpGame = true');
		else if (filters.vp.indeterminate) parts.push('isVpGame = false');

		if (filters.highResources.value) parts.push('isHighResources = true');
		else if (filters.highResources.indeterminate) parts.push('isHighResources = false');

		if (filters.maps.length > 0) {
			const mapExpr = filters.maps
				.map((m) => `mapName = "${escapePocketBaseString(m)}"`)
				.join(' || ');
			parts.push(`(${mapExpr})`);
		}

		if (filters.players.length > 0) {
			const playerExpr = filters.players
				.map((p) => `players ~ "${escapePocketBaseString(p)}"`)
				.join(' || ');
			parts.push(`(${playerExpr})`);
		}

		return parts.join(' && ');
	}

	let filters = $state<FiltersState>({
		query: '',
		players: [],
		maps: [],
		ranked: { value: false, indeterminate: false },
		vp: { value: false, indeterminate: false },
		highResources: { value: false, indeterminate: false }
	});

	let replays = $state<ReplaysExpanded[]>([]);
	let page = $state(1);
	let hasMore = $state(true);
	let isLoading = $state(false);

	let searchId = 0;
	let activeFilter = $state(buildPocketBaseFilter($state.snapshot(filters)));

	const debouncedFilter = new Debounced(
		() => buildPocketBaseFilter($state.snapshot(filters)),
		FILTER_DEBOUNCE_MS
	);

	function resetSearch(nextFilter: string) {
		searchId += 1;
		activeFilter = nextFilter;
	}

	async function loadMore({ reset = false }: { reset?: boolean } = {}) {
		if (isLoading) return;
		if (!hasMore && !reset) return;

		isLoading = true;
		const currentSearchId = searchId;

		if (reset) {
			page = 1;
			hasMore = true;
			replays = [];
		}

		try {
			const result = await app.database.replays().getPaginated(page, PAGE_SIZE, {
				filter: activeFilter,
				sort: '-createdAt'
			});

			if (currentSearchId !== searchId) {
				return;
			}

			replays = [...replays, ...result.items];

			page += 1;
			hasMore = result.page < result.totalPages;
		} catch (e) {
			console.error(e);
		} finally {
			if (currentSearchId === searchId) {
				isLoading = false;
			}
		}
	}

	watch(
		() => debouncedFilter.current,
		(nextFilter) => {
			resetSearch(nextFilter);
			loadMore({ reset: true });
		}
	);

	function viewport(node: HTMLElement) {
		const observer = new IntersectionObserver((entries) => {
			if (!entries[0]?.isIntersecting) return;
			if (isLoading || !hasMore) return;
			loadMore();
		});

		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

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
</script>

<H level="1" class="mb-8">Replays</H>
<Form.Root class="border-secondary-800 mb-4 border-b pb-4">
	<Form.Group>
		<Checkbox
			label="Only ranked games"
			bind:checked={filters.ranked.value}
			bind:indeterminate={filters.ranked.indeterminate}
		/>
	</Form.Group>
	<Form.Group>
		<Checkbox
			label="Only games with Victory Points"
			bind:checked={filters.vp.value}
			bind:indeterminate={filters.vp.indeterminate}
		/>
	</Form.Group>
	<Form.Group>
		<Checkbox
			label="Only games with High Resources"
			bind:checked={filters.highResources.value}
			bind:indeterminate={filters.highResources.indeterminate}
		/>
	</Form.Group>
	<Form.Group>
		<Form.Label>Filter players</Form.Label>
		<Selection
			options={playersList}
			placeholder="Select players..."
			multiple
			bind:value={filters.players}
		/>
	</Form.Group>
	<div class="grid grid-cols-[250px_1fr] gap-4">
		<Form.Group>
			<Form.Label>Title</Form.Label>
			<Input placeholder="Enter title" bind:value={filters.query} />
		</Form.Group>
		<Form.Group>
			<Form.Label>Filter map(s)</Form.Label>
			<Selection
				options={mapsList}
				placeholder="Select maps..."
				multiple
				bind:value={filters.maps}
			/>
		</Form.Group>
	</div>
</Form.Root>
<Table>
	<THead>
		<TH width="4/24">Title</TH>
		<TH width="4/24">Allies</TH>
		<TH width="4/24">Axis</TH>
		<TH width="3/24">Duration</TH>
		<TH width="2/24" class="text-center">Players</TH>
		<TH width="3/24">Map</TH>
		<TH width="4/24">Date</TH>
	</THead>

	{#if replays.length > 0}
		{#each replays as item (item.id)}
			{@const allies = item.players?.filter((p) => p.faction.startsWith('allies')) || []}
			{@const axis = item.players?.filter((p) => p.faction.startsWith('axis')) || []}
			<TR href={`/replays/${item.id}`} class="text-secondary-300">
				<TD width="4/24" class="truncate">{item.title}</TD>
				<TD width="4/24" class="flex gap-2">
					<span class="flex items-center gap-2">
						{#each allies as player}
							<img
								src={getFactionFlagFromRace(
									player.faction as 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite'
								)}
								alt={player.faction}
								class={cn('ring-secondary-800 h-4 w-4 rounded-full object-cover ring-4')}
								{@attach tooltip(player.name)}
							/>
						{/each}
					</span>
				</TD>
				<TD width="4/24" class="flex gap-2">
					<span class="flex items-center gap-2">
						{#each axis as player}
							<img
								src={getFactionFlagFromRace(
									player.faction as 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite'
								)}
								alt={player.faction}
								class={cn('ring-secondary-800 h-4 w-4 rounded-full object-cover ring-4')}
								{@attach tooltip(player.name)}
							/>
						{/each}
					</span>
				</TD>
				<TD width="3/24">
					{dayjs
						.duration(item.durationInSeconds, 'seconds')
						.format(item.durationInSeconds < 3600 ? 'm[min]' : 'H[hr] m[min]')}
				</TD>
				<TD width="2/24" class="text-center">{item.players?.length}</TD>
				<TD width="3/24" class="truncate">{getString(item.mapName)}</TD>
				<TD width="4/24" class="truncate">{dayjs(item.gameDate).format('YYYY-MM-DD HH:mm')}</TD>
			</TR>
		{/each}

		{#if hasMore}
			<div use:viewport class="border-secondary-800 w-full border-t px-4 py-2">
				<small>
					Showing {replays.length} replays
					{#if isLoading}
						(loading...)
					{/if}
				</small>
			</div>
		{:else}
			<div class="border-secondary-800 w-full border-t px-4 py-2">
				<small>Showing {replays.length} replays</small>
			</div>
		{/if}
	{:else}
		<div class="border-secondary-800 w-full border-t px-4 py-2">
			<small>
				{#if isLoading}
					Loading replays...
				{:else}
					No replays found.
				{/if}
			</small>
		</div>
	{/if}
</Table>
