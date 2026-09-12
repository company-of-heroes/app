<script lang="ts">
	import type { Snapshot } from './$types';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import * as Match from '$lib/components/match';
	import { cn } from '$lib/utils';
	import { tabTrigger } from '$lib/components/ui/variants';
	import { Pagination } from '$lib/components/ui/pagination';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Button } from '$lib/components/ui/button';
	import { Sheet } from '@company-of-heroes/ui/sheet';
	import { app } from '$core/app/context';
	import type { MatchExpanded } from '$core/app/database/matches';
	import { useI18n } from '$lib/i18n';
	import { page } from '$app/state';
	import { beforeNavigate, goto } from '$app/navigation';
	import { watch } from 'runed';
	import HistoryFilters from './history-filters.svelte';
	import MyReplays from './my-replays.svelte';
	import MemberReplays from './member-replays.svelte';
	import { ReplayList, type ReplayListState } from '../replays/replay-list.svelte';
	import { scoreClassName } from '@company-of-heroes/ui/comment';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import ChatCircleIcon from 'phosphor-svelte/lib/ChatCircleIcon';
	import FunnelSimpleIcon from 'phosphor-svelte/lib/FunnelSimpleIcon';
	import { Sort, type ReplaysQuery } from '@company-of-heroes/ui/replay';
	import {
		historyListHref,
		historyListStateFromMatches,
		historyListStateKey,
		parseHistoryListState,
		rememberHistoryListHref,
		tabFromSearch,
		type HistoryTab
	} from '$core/app/features/history/history-url';

	const emptyMemberQuery = (): ReplaysQuery => ({
		page: 1,
		ranked: false,
		pro: false,
		matchups: [],
		playerIds: [],
		maps: [],
		races: [],
		positions: [],
		elo: null,
		duration: null,
		filter: null,
		sort: 'createdAt',
		sortDir: 'desc'
	});

	type HistoryPageSnapshot = {
		replayList: ReplayListState;
		matches: ReturnType<NonNullable<typeof app.features.history>['matches']['capture']> | null;
		memberQuery: ReplaysQuery;
	};

	const { t } = useI18n();
	const matches = $derived(app.features.history?.matches);
	const historyFeature = $derived(app.features.history);
	const tab = $derived(tabFromSearch(page.url.searchParams));
	let replayList = $state(new ReplayList());
	let applyingUrl = $state(false);
	let filtersOpen = $state(false);
	const filtersActive = $derived(matches?.filters.filter != null);

	function catalogHref() {
		if (!matches || (tab !== 'user' && tab !== 'community')) {
			const params = new URLSearchParams();
			if (tab !== 'user') {
				params.set('tab', tab);
			}

			const search = params.toString();
			return search ? `/history?${search}` : '/history';
		}

		return historyListHref(historyListStateFromMatches(matches), tab);
	}

	beforeNavigate(() => {
		rememberHistoryListHref(catalogHref());
	});

	watch(
		() => page.url.search,
		(search) => {
			if (!matches || (tab !== 'user' && tab !== 'community')) {
				return;
			}

			const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
			const parsed = parseHistoryListState(params);
			const nextScope = tab === 'community' ? 'community' : 'user';
			const currentKey = historyListStateKey(historyListStateFromMatches(matches), matches.scope);
			const nextKey = historyListStateKey(parsed, nextScope);
			if (currentKey === nextKey && matches.scope === nextScope) {
				return;
			}

			applyingUrl = true;
			matches.setScopePreservingFilters(nextScope);
			matches.applyListState(parsed);
			queueMicrotask(() => {
				applyingUrl = false;
			});
		}
	);

	watch(
		() => {
			if (!matches || (tab !== 'user' && tab !== 'community')) {
				return null;
			}

			return historyListStateKey(historyListStateFromMatches(matches), tab);
		},
		(href) => {
			if (!href || applyingUrl) {
				return;
			}

			const current = `${page.url.pathname}${page.url.search}`;
			if (current === href) {
				return;
			}

			rememberHistoryListHref(href);
			void goto(href, {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
		}
	);

	function setTab(next: HistoryTab) {
		filtersOpen = false;
		if ((next === 'user' || next === 'community') && matches) {
			if (matches.scope !== next) {
				matches.scope = next;
			}
			const href = historyListHref(historyListStateFromMatches(matches), next);
			rememberHistoryListHref(href);
			void goto(href, {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
			return;
		}

		const params = new URLSearchParams();
		params.set('tab', next);
		const href = `/history?${params.toString()}`;
		rememberHistoryListHref(href);
		void goto(href, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	export const snapshot: Snapshot<HistoryPageSnapshot> = {
		capture: () => ({
			replayList: replayList.capture(),
			matches: matches?.capture() ?? null,
			memberQuery: $state.snapshot(historyFeature?.memberQuery ?? emptyMemberQuery())
		}),
		restore: (value) => {
			replayList.restore(value.replayList);
			matches?.restore(value.matches);
			if (historyFeature && value.memberQuery) {
				historyFeature.memberQuery = value.memberQuery;
			}
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
	<div class="flex min-h-0 flex-1 flex-col">
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
		{#if tab === 'user' || tab === 'community'}
			<div class="border-secondary-800 flex items-center justify-end gap-2 border-t px-4 py-2">
				<Sort
					sort={matches.sort}
					sortDir={matches.sortDir}
					onChange={({ sort, sortDir }) => {
						matches.sort = sort;
						matches.sortDir = sortDir;
						matches.page = 1;
					}}
					dateLabel={t('Date')}
					likesLabel={t('Likes')}
					downloadsLabel={t('Downloads')}
					commentsLabel={t('Comments')}
					ascendingLabel={t('Ascending')}
					descendingLabel={t('Descending')}
				/>
				<Button variant="secondary" size="sm" onclick={() => (filtersOpen = true)}>
					<span class="relative inline-flex">
						<FunnelSimpleIcon class="size-4" />
						{#if filtersActive}
							<span
								class="bg-primary absolute -end-0.5 -top-0.5 size-1.5 rounded-full"
								aria-hidden="true"
							></span>
						{/if}
					</span>
					{t('Filters')}
				</Button>
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
		<Match.Players team="allies" highlightedPlayers={matches.filters.playerIds} />
	{/snippet}
	{#snippet cell_axis({ row: _row }: { row: MatchExpanded })}
		<Match.Players team="axis" highlightedPlayers={matches.filters.playerIds} />
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
		<MemberReplays bind:query={app.features.history.memberQuery} />
	{:else}
		<div class="min-w-0 flex-1 overflow-auto">
			{#if matches.tableLoading}
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
				<div
					class={cn(matches.result.loading && 'pointer-events-none opacity-60 transition-opacity')}
				>
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
		</div>
	{/if}
	</div>

	{#if tab === 'user' || tab === 'community'}
		<Sheet bind:open={filtersOpen} side="left" title={t('Filters')} closeLabel={t('Close')}>
			<HistoryFilters {matches} />
		</Sheet>
	{/if}
{/if}
