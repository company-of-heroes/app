<script lang="ts">
	import * as Form from '$lib/components/ui/form';
	import { app } from '$core/app';
	import { tooltip } from '$lib/attachments';
	import { H } from '$lib/components/ui/h';
	import { Pagination } from '$lib/components/ui/pagination';
	import { Table, TD, TH, THead, TR } from '$lib/components/ui/table';
	import dayjs from '$lib/dayjs';
	import { cn, getFactionFlagFromRace } from '$lib/utils';
	import { getString } from '$lib/utils/game';
	import { resource } from 'runed';
	import { isEmpty, uniqBy } from 'lodash-es';
	import { Input, Selection } from '$lib/components/ui/input';
	import Checkbox from '$lib/components/ui/input/checkbox.svelte';
	import type { ReplaysExpanded } from '$core/app/database/replays';

	let filters = $state({
		query: '',
		players: [] as string[],
		maps: [] as string[],
		ranked: {
			value: false,
			indeterminate: false
		},
		vp: {
			value: false,
			indeterminate: false
		},
		highResources: {
			value: false,
			indeterminate: false
		}
	});

	let replays = $state<ReplaysExpanded[]>([]);
	let filteredReplays = $state<ReplaysExpanded[]>([]);
	let displayedCount = $state(50);
	let displayedReplays = $derived(filteredReplays.slice(0, displayedCount));

	const FILTER_CONFIG = {
		boolean: [
			{ key: 'ranked', property: 'isRanked' },
			{ key: 'vp', property: 'isVpGame' },
			{ key: 'highResources', property: 'isHighResources' }
		] as const
	};

	function viewport(node: HTMLElement) {
		const observer = new IntersectionObserver((entries) => {
			if (entries[0].isIntersecting) {
				displayedCount += 50;
			}
		});
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	let query = resource(
		() => $state.snapshot(filters),
		(filters) => {
			return new Promise<ReplaysExpanded[]>(async (resolve) => {
				if (replays.length === 0) {
					replays = await app.database.replays().getAll();
				}

				let result = replays
					.filter((replay) =>
						isEmpty(filters.query)
							? true
							: replay.title.toLowerCase().includes(filters.query.toLowerCase())
					)
					.filter((replay) =>
						filters.players.length === 0
							? true
							: replay.players?.some((p) => filters.players.includes(p.name))
					)
					.filter((replay) =>
						filters.maps.length === 0 ? true : filters.maps.includes(replay.mapName)
					);

				for (const { key, property } of FILTER_CONFIG.boolean) {
					const filter = filters[key];

					if (filter.value) {
						result = result.filter((replay) => replay[property]);
					} else if (filter.indeterminate) {
						result = result.filter((replay) => !replay[property]);
					}
				}

				displayedCount = 50;
				resolve((filteredReplays = result));
			});
		},
		{
			debounce: 300
		}
	);
	let playersList = $derived(
		uniqBy(
			replays.map((r) => r.players!.map((p) => ({ value: p.name, label: p.name }))).flat() || [],
			'value'
		)
	);
	let mapsList = $derived(
		uniqBy(
			replays
				.map((r) => ({ value: r.mapName || 'Unknown', label: getString(r.mapName) || 'Unknown' }))
				.flat() || [],
			'value'
		)
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
		<TH width="3/24">Allies</TH>
		<TH width="3/24">Axis</TH>
		<TH width="2/24">Duration</TH>
		<TH width="2/24" class="text-center">Players</TH>
		<TH width="3/24">Map</TH>
		<TH width="3/24">Date</TH>
	</THead>
	{#if query.loading}
		{#each Array(10) as _, i}
			<TR>
				<TD width="4/24">
					<div class="h-4 w-3/4 animate-pulse rounded bg-gray-700/50"></div>
				</TD>
				<TD width="3/24">
					<div class="h-4 w-1/2 animate-pulse rounded bg-gray-700/50"></div>
				</TD>
				<TD width="3/24">
					<div class="h-4 w-1/2 animate-pulse rounded bg-gray-700/50"></div>
				</TD>
				<TD width="2/24">
					<div class="h-4 w-1/3 animate-pulse rounded bg-gray-700/50"></div>
				</TD>
				<TD width="2/24" class="text-center">
					<div class="mx-auto h-4 w-1/4 animate-pulse rounded bg-gray-700/50"></div>
				</TD>
				<TD width="3/24">
					<div class="h-4 w-1/2 animate-pulse rounded bg-gray-700/50"></div>
				</TD>
				<TD width="3/24">
					<div class="h-4 w-2/3 animate-pulse rounded bg-gray-700/50"></div>
				</TD>
			</TR>
		{/each}
	{:else if displayedReplays}
		{#each displayedReplays as item, _ (item.id)}
			{@const allies = item.players?.filter((p) => p.faction.startsWith('allies')) || []}
			{@const axis = item.players?.filter((p) => p.faction.startsWith('axis')) || []}
			<TR href={`/replays/${item.id}`}>
				<TD width="4/24" class="truncate">{item.title}</TD>
				<TD width="3/24" class="flex gap-2">
					<span class="flex items-center truncate">
						{#each allies as player}
							<img
								src={getFactionFlagFromRace(
									player.faction as 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite'
								)}
								alt={player.faction}
								class={cn(
									'border-secondary-950 size-5 rounded-full border-4 object-cover not-first:-ml-2'
								)}
								{@attach tooltip(player.name)}
							/>
						{/each}
					</span>
				</TD>
				<TD width="3/24" class="flex gap-2">
					<span class="flex items-center">
						{#each axis as player}
							<img
								src={getFactionFlagFromRace(
									player.faction as 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite'
								)}
								alt={player.faction}
								class={cn(
									'border-secondary-950 size-5 rounded-full border-4 object-cover not-first:-ml-2'
								)}
								{@attach tooltip(player.name)}
							/>
						{/each}
					</span>
				</TD>
				<TD width="2/24">
					{dayjs
						.duration(item.durationInSeconds, 'seconds')
						.format(item.durationInSeconds < 3600 ? 'm[min]' : 'H[hr] m[min]')}
				</TD>
				<TD width="2/24" class="text-center">{item.players?.length}</TD>
				<TD width="3/24" class="truncate">{getString(item.mapName)}</TD>
				<TD width="3/24">{dayjs(item.gameDate).format('YYYY-MM-DD HH:mm')}</TD>
			</TR>
		{/each}
		<div use:viewport class="border-secondary-800 w-full border-t px-4 py-2">
			<small>Showing {displayedReplays.length} of {replays.length} replays</small>
		</div>
	{/if}
</Table>
