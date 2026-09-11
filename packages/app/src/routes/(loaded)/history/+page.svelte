<script lang="ts">
	import type { Snapshot } from './$types';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import * as Match from '$lib/components/match';
	import { cn } from '$lib/utils';
	import { tabTrigger } from '$lib/components/ui/variants';
	import { Pagination } from '$lib/components/ui/pagination';
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
			width: 'w-6/24',
			class: 'flex h-full min-w-0 items-center gap-0',
			cellClass: () => 'overflow-clip py-0 pr-0 pl-4',
			href: (match) => `/history/${match.id}`
		},
		{
			id: 'allies',
			header: t('Allies'),
			width: 'w-3/24',
			class: 'flex h-full items-center overflow-visible',
			cellClass: (row) => {
				const outcome = Match.resolveTeamOutcome(row, 'allies');
				return cn(
					outcome === 'win' && 'bg-green-500/5',
					outcome === 'loss' && 'bg-red-500/5'
				);
			}
		},
		{
			id: 'axis',
			header: t('Axis'),
			width: 'w-3/24',
			class: 'flex h-full items-center overflow-visible',
			cellClass: (row) => {
				const outcome = Match.resolveTeamOutcome(row, 'axis');
				return cn(
					outcome === 'win' && 'bg-green-500/5',
					outcome === 'loss' && 'bg-red-500/5'
				);
			}
		},
		{ id: 'duration', header: t('Duration'), width: 'w-2/24' },
		{
			id: 'likes',
			header: t('Likes'),
			width: 'w-2/24',
			class: 'flex items-center justify-end tabular-nums',
			headerClass: 'justify-end',
			sortable: true,
			onSort: () => matches?.toggleSort('likeCount'),
			sortDirection: matches?.sort === 'likeCount' ? matches.sortDir : null
		},
		{
			id: 'comments',
			header: t('Comments'),
			width: 'w-2/24',
			class: 'flex items-center justify-end tabular-nums',
			headerClass: 'justify-end',
			sortable: true,
			onSort: () => matches?.toggleSort('commentCount'),
			sortDirection: matches?.sort === 'commentCount' ? matches.sortDir : null
		},
		{
			id: 'downloads',
			header: t('Downloads'),
			width: 'w-2/24',
			class: 'flex items-center justify-end tabular-nums',
			headerClass: 'justify-end',
			sortable: true,
			onSort: () => matches?.toggleSort('downloadCount'),
			sortDirection: matches?.sort === 'downloadCount' ? matches.sortDir : null
		},
		{
			id: 'date',
			header: t('Date'),
			width: 'w-4/24',
			class: 'flex items-center',
			headerClass: 'text-end'
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
	{#snippet cell_allies({ row }: { row: MatchExpanded })}
		<Match.Players team="allies" highlightedPlayers={matches.filters.playerIds ?? []} />
	{/snippet}
	{#snippet cell_axis({ row }: { row: MatchExpanded })}
		<Match.Players team="axis" highlightedPlayers={matches.filters.playerIds ?? []} />
	{/snippet}
	{#snippet cell_duration({ row: _row }: { row: MatchExpanded })}
		<Match.Duration class="text-secondary-400 text-sm" />
	{/snippet}
	{#snippet cell_likes({ row }: { row: MatchExpanded })}
		<span
			class={cn(
				'inline-flex items-center gap-1.5 text-sm tabular-nums',
				scoreClassName(row.likeCount ?? 0, 'text-secondary-400')
			)}
		>
			<CaretUpIcon size={16} weight="fill" />
			{row.likeCount ?? 0}
		</span>
	{/snippet}
	{#snippet cell_comments({ row }: { row: MatchExpanded })}
		<span class="text-secondary-400 inline-flex items-center gap-1.5 text-sm tabular-nums">
			<ChatCircleIcon size={16} weight="duotone" />
			{row.commentCount ?? 0}
		</span>
	{/snippet}
	{#snippet cell_downloads({ row }: { row: MatchExpanded })}
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
		/>
	{:else if matches.displayedResult}
		<div class={cn(matches.result.loading && 'pointer-events-none opacity-60 transition-opacity')}>
			<DataTable
				data={matches.displayedResult.items}
				{columns}
				rowKey={(match) => match.id}
				rowWrapper={matchRowWrapper}
				cells={{
					map: cell_map,
					allies: cell_allies,
					axis: cell_axis,
					duration: cell_duration,
					likes: cell_likes,
					comments: cell_comments,
					downloads: cell_downloads,
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
