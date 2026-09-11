<script lang="ts">
	import type { Snapshot } from './$types';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import * as Match from '$lib/components/match';
	import { cn } from '$lib/utils';
	import { tabTrigger } from '$lib/components/ui/variants';
	import { Pagination } from '$lib/components/ui/pagination';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { app } from '$core/app/context';
	import type { MatchExpanded } from '$core/app/database/matches';
	import { useI18n } from '$lib/i18n';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { watch } from 'runed';
	import HistoryFilters from './history-filters.svelte';
	import MyReplays from './my-replays.svelte';
	import MemberReplays from './member-replays.svelte';
	import { ReplayList, type ReplayListState } from '../replays/replay-list.svelte';
	import { scoreClassName } from '@company-of-heroes/ui/comment';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import ChatCircleIcon from 'phosphor-svelte/lib/ChatCircleIcon';

	type HistoryTab = 'user' | 'community' | 'replays' | 'member';

	function tabFromSearch(search: URLSearchParams): HistoryTab {
		const value = search.get('tab');
		if (value === 'community' || value === 'replays' || value === 'member') return value;
		return 'user';
	}

	const { t } = useI18n();
	const matches = $derived(app.features.history?.matches);
	const tab = $derived(tabFromSearch(page.url.searchParams));
	let replayList = $state(new ReplayList());

	watch(
		() => [tab, matches] as const,
		([next, current]) => {
			if (!current) return;
			if ((next === 'user' || next === 'community') && current.scope !== next) {
				current.scope = next;
			}
		}
	);

	function setTab(next: HistoryTab) {
		if ((next === 'user' || next === 'community') && matches) {
			matches.scope = next;
		}
		const params = new URLSearchParams(page.url.searchParams);
		if (next === 'user') params.delete('tab');
		else params.set('tab', next);
		const search = params.toString();
		void goto(search ? `/history?${search}` : '/history', {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	export const snapshot: Snapshot<ReplayListState> = {
		capture: () => replayList.capture(),
		restore: (value) => {
			replayList.restore(value);
		}
	};

	const columns: ColumnDef<MatchExpanded>[] = $derived([
		{
			id: 'map',
			header: t('Map'),
			width: 'w-full',
			class: 'flex h-full min-w-0 items-center gap-0',
			cellClass: () => 'overflow-clip py-0 pr-0 pl-4',
			href: (match) => `/history/${match.id}`
		},
		{
			id: 'allies',
			header: t('Allies'),
			class: 'flex items-center px-2',
			pad: false,
			cellClass: () => 'whitespace-nowrap',
			headerCellClass: 'px-2 py-3 whitespace-nowrap'
		},
		{
			id: 'axis',
			header: t('Axis'),
			class: 'flex items-center px-2',
			pad: false,
			cellClass: () => 'whitespace-nowrap',
			headerCellClass: 'px-2 py-3 whitespace-nowrap'
		},
		{
			id: 'duration',
			header: t('Duration'),
			cellClass: () => 'whitespace-nowrap',
			headerCellClass: 'whitespace-nowrap'
		},
		{
			id: 'engagement',
			header: '',
			class: 'flex items-center justify-end gap-3 tabular-nums',
			cellClass: () => 'whitespace-nowrap',
			headerCellClass: 'whitespace-nowrap'
		},
		{
			id: 'date',
			header: t('Date'),
			class: 'flex items-center',
			headerClass: 'text-end',
			cellClass: () => 'whitespace-nowrap',
			headerCellClass: 'whitespace-nowrap text-end'
		}
	]);
</script>

{#if matches}
	<div class="border-secondary-800 border-b">
		<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
			<div class="flex items-center gap-2">
				<button
					type="button"
					class={tabTrigger}
					data-state={tab === 'user' ? 'active' : undefined}
					onclick={() => setTab('user')}
				>
					{t('My matches')}
				</button>
				<button
					type="button"
					class={tabTrigger}
					data-state={tab === 'community' ? 'active' : undefined}
					onclick={() => setTab('community')}
				>
					{t('Community matches')}
				</button>
				<button
					type="button"
					class={tabTrigger}
					data-state={tab === 'replays' ? 'active' : undefined}
					onclick={() => setTab('replays')}
				>
					{t('My replays')}
				</button>
				<button
					type="button"
					class={tabTrigger}
					data-state={tab === 'member' ? 'active' : undefined}
					onclick={() => setTab('member')}
				>
					{t('Member replays')}
				</button>
			</div>
			{#if tab !== 'replays' && tab !== 'member' && matches.displayedResult}
				<Pagination
					class="ms-auto shrink-0"
					bind:page={matches.page}
					perPage={matches.perPage}
					count={matches.displayedResult.totalItems}
				/>
			{/if}
		</div>
		{#if tab !== 'replays' && tab !== 'member'}
			<div class="border-secondary-800 flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
				<HistoryFilters {matches} />
			</div>
		{/if}
	</div>

	{#snippet cell_map({ row: _row }: { row: MatchExpanded })}
		<Match.MapImage small flush />
		<div class="flex min-w-0 items-center gap-2 px-4">
			<Match.MapName class="min-w-0 truncate" />
			<Match.Title iconsOnly class="shrink-0" />
		</div>
	{/snippet}
	{#snippet cell_allies({ row: _row }: { row: MatchExpanded })}
		<Match.Players team="allies" highlightedPlayers={matches.filters.playerIds ?? []} />
	{/snippet}
	{#snippet cell_axis({ row: _row }: { row: MatchExpanded })}
		<Match.Players team="axis" highlightedPlayers={matches.filters.playerIds ?? []} />
	{/snippet}
	{#snippet cell_duration({ row: _row }: { row: MatchExpanded })}
		<Match.Duration class="text-secondary-400 text-sm" />
	{/snippet}
	{#snippet cell_engagement({ row }: { row: MatchExpanded })}
		<span
			class={cn(
				'inline-flex items-center gap-1.5 text-sm tabular-nums',
				scoreClassName(row.likeCount ?? 0, 'text-secondary-400')
			)}
		>
			<CaretUpIcon size={16} weight="fill" />
			{row.likeCount ?? 0}
		</span>
		<span class="text-secondary-400 inline-flex items-center gap-1.5 text-sm tabular-nums">
			<ChatCircleIcon size={16} weight="duotone" />
			{row.commentCount ?? 0}
		</span>
		<span class="text-secondary-400 inline-flex items-center gap-1.5 text-sm tabular-nums">
			<DownloadIcon size={16} weight="duotone" />
			{row.downloadCount ?? 0}
		</span>
	{/snippet}
	{#snippet cell_date({ row: _row }: { row: MatchExpanded })}
		{#if matches.scope === 'user'}
			<Match.Rating />
		{/if}
		<Match.Date class="text-secondary-400 ms-auto text-sm" />
	{/snippet}
	{#snippet skeleton_map()}
		<div class="flex h-11 items-center">
			<Skeleton class="size-11 shrink-0 rounded-none" />
			<div class="px-4">
				<Skeleton class="h-4 w-36" />
			</div>
		</div>
	{/snippet}
	{#snippet skeleton_team()}
		<div class="flex h-11 items-center gap-0">
			<Skeleton class="size-11 shrink-0 rounded-none" />
			<Skeleton class="size-11 shrink-0 rounded-none" />
		</div>
	{/snippet}
	{#snippet skeleton_duration()}
		<div class="flex h-11 items-center">
			<Skeleton class="h-4 w-14" />
		</div>
	{/snippet}
	{#snippet skeleton_engagement()}
		<div class="flex h-11 items-center justify-end gap-3">
			<Skeleton class="h-4 w-8" />
			<Skeleton class="h-4 w-8" />
			<Skeleton class="h-4 w-8" />
		</div>
	{/snippet}
	{#snippet skeleton_date()}
		<div class="flex h-11 items-center justify-end">
			<Skeleton class="h-4 w-28" />
		</div>
	{/snippet}
	{#snippet matchRowWrapper({
		row,
		children
	}: {
		row: MatchExpanded;
		children: import('svelte').Snippet;
	})}
		<Match.Root match={row}>
			{@render children()}
		</Match.Root>
	{/snippet}

	{#if tab === 'replays'}
		<MyReplays bind:list={replayList} />
	{:else if tab === 'member'}
		<MemberReplays />
	{:else if matches.tableLoading}
		<DataTable
			data={[]}
			{columns}
			rowKey={(match) => match.id}
			loading
			skeletonRows={matches.perPage}
			tableLayout="auto"
			skeletons={{
				map: skeleton_map,
				allies: skeleton_team,
				axis: skeleton_team,
				duration: skeleton_duration,
				engagement: skeleton_engagement,
				date: skeleton_date
			}}
			skeletonClasses={{
				map: 'overflow-clip py-0 pr-0 pl-4',
				allies: 'px-2 whitespace-nowrap',
				axis: 'px-2 whitespace-nowrap',
				duration: 'px-4 py-0 whitespace-nowrap',
				engagement: 'px-4 py-0 whitespace-nowrap',
				date: 'px-4 py-0 whitespace-nowrap text-end'
			}}
		/>
	{:else if matches.displayedResult}
		<div class={cn(matches.result.loading && 'pointer-events-none opacity-60 transition-opacity')}>
			<DataTable
				data={matches.displayedResult.items}
				{columns}
				rowKey={(match) => match.id}
				rowWrapper={matchRowWrapper}
				tableLayout="auto"
				cells={{
					map: cell_map,
					allies: cell_allies,
					axis: cell_axis,
					duration: cell_duration,
					engagement: cell_engagement,
					date: cell_date
				}}
			/>
		</div>
		<div class="flex px-5 py-3">
			<Pagination
				class="ms-auto"
				bind:page={matches.page}
				perPage={matches.perPage}
				count={matches.displayedResult.totalItems}
			/>
		</div>
	{/if}
{/if}
