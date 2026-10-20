<script lang="ts">
	import type { Snapshot } from './$types';
	import { Pagination } from '$lib/components/ui/pagination';
	import { Sheet } from '@company-of-heroes/ui/sheet';
	import {
		List as ReplayList,
		ListSkeleton as ReplayListSkeleton,
		type CommunityMatch,
		type HistoryMatchup,
		type ReplayLayout
	} from '@company-of-heroes/ui/replay';
	import {
		ArchiveFilterBar,
		LayoutToggle,
		ReplaysPage,
		type ArchiveQuickFilters,
		type ReplaysView
	} from '@company-of-heroes/ui/replay-browse';
	import { cn } from '$lib/utils';
	import { app } from '$core/app/context';
	import { useI18n } from '$lib/i18n';
	import { page } from '$app/state';
	import { beforeNavigate, goto } from '$app/navigation';
	import { scheduleGoto } from '$core/runtime/schedule-goto';
	import { watch } from 'runed';
	import { getMeSteamIds } from '$lib/utils/player-me';
	import HistoryFilters from './history-filters.svelte';
	import MyReplays from './my-replays.svelte';
	import ReplaysDiscover from './replays-discover.svelte';
	import CommunityGroups from './community-groups.svelte';
	import { ReplayList as LibraryList, type ReplayListState } from '../replays/replay-list.svelte';
	import {
		historyListHref,
		historyListStateFromMatches,
		historyListStateKey,
		parseHistoryListState,
		rememberHistoryListHref,
		tabFromSearch,
		type HistoryTab
	} from '$core/app/features/history/history-url';

	type HistoryPageSnapshot = {
		replayList: ReplayListState;
		matches: ReturnType<NonNullable<typeof app.features.history>['matches']['capture']> | null;
	};

	const { t } = useI18n();
	const matches = $derived(app.features.history?.matches);
	const tab = $derived(tabFromSearch(page.url.searchParams));
	let replayList = $state(new LibraryList());
	let applyingUrl = $state(false);
	let filtersOpen = $state(false);
	const mySteamIds = $derived(getMeSteamIds());
	const archive = $derived(tab === 'user' || tab === 'community');
	const layout = $derived<ReplayLayout>(app.features.history?.settings.replaysLayout ?? 'list');
	/** Unfiltered first page of Community matches: one grid per game type (cards only). */
	const grouped = $derived(
		layout === 'grid' &&
			tab === 'community' &&
			!!matches &&
			matches.page === 1 &&
			matches.filters.matchups.length === 0 &&
			matches.filters.filter == null
	);
	const quick = $derived<ArchiveQuickFilters>({
		matchups: (matches?.filters.matchups ?? []) as HistoryMatchup[],
		ranked: matches?.filters.ranked ?? false,
		pro: matches?.filters.pro ?? false
	});
	/** Filters the chip bar does not show. */
	const advancedActive = $derived(
		!!matches &&
			(matches.filters.filter != null ||
				matches.filters.maps.length > 0 ||
				matches.filters.playerIds.length > 0 ||
				matches.filters.races.length > 0 ||
				matches.filters.positions.length > 0 ||
				!!matches.filters.elo ||
				!!matches.filters.duration)
	);

	const views = $derived<{ id: ReplaysView; label: string }[]>([
		{ id: 'discover', label: t('Discover') },
		{ id: 'community', label: t('Community matches') },
		{ id: 'mine', label: t('My matches') },
		{ id: 'library', label: t('My library') }
	]);
	const viewOfTab: Record<HistoryTab, ReplaysView> = {
		discover: 'discover',
		community: 'community',
		user: 'mine',
		replays: 'library'
	};
	const tabOfView: Record<ReplaysView, HistoryTab> = {
		discover: 'discover',
		community: 'community',
		mine: 'user',
		library: 'replays'
	};

	/** Chips set flat filters; an advanced filter would win on the server, so it is dropped. */
	function applyQuick(next: ArchiveQuickFilters) {
		if (!matches) {
			return;
		}

		matches.filters = { ...matches.filters, ...next, filter: undefined };
		matches.page = 1;
	}

	function setLayout(next: ReplayLayout) {
		if (app.features.history) {
			app.features.history.settings.replaysLayout = next;
		}
	}

	function catalogHref() {
		if (!matches || (tab !== 'user' && tab !== 'community')) {
			return tab === 'discover' ? '/history' : `/history?tab=${tab}`;
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
			scheduleGoto(href, {
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

		const href = next === 'discover' ? '/history' : `/history?tab=${next}`;
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
			matches: matches?.capture() ?? null
		}),
		restore: (value) => {
			replayList.restore(value.replayList);
			matches?.restore(value.matches);
		}
	};
</script>

<ReplaysPage
	{views}
	active={viewOfTab[tab]}
	onSelect={(view) => setTab(tabOfView[view])}
	uploadHref="/replays/upload"
	showTitle={false}
>
	{#snippet aside()}
		{#if tab === 'discover'}
			<LayoutToggle value={layout} onChange={setLayout} />
		{:else if archive && !grouped && matches?.displayedResult}
			<Pagination
				bind:page={matches.page}
				perPage={matches.perPage}
				count={matches.displayedResult.totalItems}
			/>
		{/if}
	{/snippet}

	{#if tab === 'discover'}
		<div class="min-w-0 flex-1 overflow-auto">
			<ReplaysDiscover {layout} />
		</div>
	{:else if !matches}
		<!-- Without the game's log folder there are no local matches or replays. -->
	{:else if tab === 'replays'}
		<MyReplays bind:list={replayList} />
	{:else}
		<ArchiveFilterBar
			value={quick}
			onChange={applyQuick}
			sort={matches.sort}
			sortDir={matches.sortDir}
			onSortChange={({ sort, sortDir }) => {
				matches.sort = sort;
				matches.sortDir = sortDir;
				matches.page = 1;
			}}
			onOpenFilters={() => (filtersOpen = true)}
			{advancedActive}
			{layout}
			onLayoutChange={setLayout}
		/>
		<div class="min-w-0 flex-1 overflow-auto">
			{#if grouped}
				<CommunityGroups {matches} />
			{:else if matches.tableLoading}
				<ReplayListSkeleton {layout} rowCount={layout === 'list' ? matches.perPage : 8} />
			{:else if matches.displayedResult}
				<div
					class={cn(matches.result.loading && 'pointer-events-none opacity-60 transition-opacity')}
				>
					<ReplayList
						matches={matches.displayedResult.items as unknown as CommunityMatch[]}
						highlightedPlayers={matches.filters.playerIds}
						meSteamIds={mySteamIds}
						sort={matches.sort}
						sortDir={matches.sortDir}
						onSort={() => {}}
						emptyMessage={tab === 'community'
							? t('No community replays found.')
							: t('No matches found.')}
						{layout}
					/>
				</div>
				<div class="border-secondary-800 flex border-t px-5 py-3">
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
</ReplaysPage>

{#if archive && matches}
	<Sheet bind:open={filtersOpen} side="left" title={t('Filters')} closeLabel={t('Close')}>
		<HistoryFilters {matches} onApplied={() => (filtersOpen = false)} />
	</Sheet>
{/if}
