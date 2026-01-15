<script lang="ts">
	import { Table, TD, TH, THead, TR } from '$lib/components/ui/table';
	import { cn, getFactionFlagFromRace } from '$lib/utils';
	import { getString } from '$lib/utils/game';
	import { tooltip } from '$lib/attachments';
	import SortAscending from 'phosphor-svelte/lib/ArrowDown';
	import SortDescending from 'phosphor-svelte/lib/ArrowUp';
	import Sortable from 'phosphor-svelte/lib/ArrowsDownUp';
	import dayjs from '$lib/dayjs';
	import type { ReplayList } from './replay-list.svelte';

	interface Props {
		list: ReplayList;
	}

	let { list }: Props = $props();

	function viewport(node: HTMLElement) {
		const observer = new IntersectionObserver((entries) => {
			if (!entries[0]?.isIntersecting) return;
			if (list.isLoading || !list.hasMore) return;
			list.loadMore();
		});

		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	function toggleDurationSort() {
		list.filters.sort.gameDate = '';
		if (list.filters.sort.duration === 'durationInSeconds') {
			list.filters.sort.duration = '-durationInSeconds';
		} else {
			list.filters.sort.duration = 'durationInSeconds';
		}
	}

	function toggleDateSort() {
		list.filters.sort.duration = '';
		if (list.filters.sort.gameDate === 'gameDate') {
			list.filters.sort.gameDate = '-gameDate';
		} else {
			list.filters.sort.gameDate = 'gameDate';
		}
	}
</script>

<Table>
	<THead>
		<TR>
			<TH width="4/24">Title</TH>
			<TH width="4/24">Allies</TH>
			<TH width="4/24">Axis</TH>
			<TH
				width="3/24"
				class="flex cursor-pointer items-center select-none"
				onclick={toggleDurationSort}
			>
				Duration
				{#if list.filters.sort.duration === 'durationInSeconds'}
					<SortAscending class="ml-auto inline-block" weight="duotone" size="18" />
				{:else if list.filters.sort.duration === '-durationInSeconds'}
					<SortDescending class="ml-auto inline-block" weight="duotone" size="18" />
				{:else}
					<Sortable class="ml-auto inline-block" weight="duotone" />
				{/if}
			</TH>
			<TH width="2/24" class="text-center">Players</TH>
			<TH width="3/24">Map</TH>
			<TH
				width="4/24"
				class="flex cursor-pointer items-center select-none"
				onclick={toggleDateSort}
			>
				Date
				{#if list.filters.sort.gameDate === 'gameDate'}
					<SortAscending class="ml-auto inline-block" weight="duotone" size="18" />
				{:else if list.filters.sort.gameDate === '-gameDate'}
					<SortDescending class="ml-auto inline-block" weight="duotone" size="18" />
				{:else}
					<Sortable class="ml-auto inline-block" weight="duotone" />
				{/if}
			</TH>
		</TR>
	</THead>

	{#if list.replays.length > 0}
		{#each list.replays as item (item.id)}
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

		{#if list.hasMore}
			<div use:viewport class="border-secondary-800 w-full border-t px-4 py-2">
				<small>
					Showing {list.replays.length} replays
					{#if list.isLoading}
						(loading...)
					{/if}
				</small>
			</div>
		{:else}
			<div class="border-secondary-800 w-full border-t px-4 py-2">
				<small>Showing {list.replays.length} replays</small>
			</div>
		{/if}
	{:else}
		<div use:viewport class="border-secondary-800 w-full border-t px-4 py-2">
			<small>
				{#if list.isLoading}
					Loading replays...
				{:else}
					No replays found.
				{/if}
			</small>
		</div>
	{/if}
</Table>
