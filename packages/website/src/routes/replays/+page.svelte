<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { watch } from 'runed';
	import { Pagination } from '@company-of-heroes/ui/pagination';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { Sheet } from '@company-of-heroes/ui/sheet';
	import {
		List as ReplayList,
		ListSkeleton as ReplayListSkeleton,
		type CommunityMatch
	} from '@company-of-heroes/ui/replay';
	import {
		ArchiveFilterBar,
		DiscoverView,
		MatchupSections,
		ReplayCardGrid,
		ReplaysPage,
		themeArchiveQuery,
		type ArchiveQuickFilters,
		type ReplaysView
	} from '@company-of-heroes/ui/replay-browse';
	import ReplayFilters from '$lib/components/replay/replay-filters.svelte';
	import {
		recentCommunityQuery,
		REPLAYS_PER_PAGE,
		rememberReplaysListHref,
		replaysHref,
		uploadReplayPath,
		type HistorySortField,
		type ReplaysQuery
	} from '$lib/replays';
	import type { HistoryMatchup } from '@company-of-heroes/ui/replay';
	import { getSharedReplaysPage } from '$lib/remote/replays.remote';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, unlocalizedPath, useI18n } from '$lib/i18n';
	import { meSteamIds } from '$lib/auth/user';
	import { SITE_URL } from '$lib/site/urls';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	let filtersOpen = $state(false);
	let shareCandidates = $state.raw<CommunityMatch[] | null>(null);

	const query = $derived(data.query);
	const tab = $derived(data.tab as ReplaysView);
	const switching = $derived(unlocalizedPath(navigating.to?.url.pathname ?? '') === '/replays');
	const canonical = $derived(`${SITE_URL}${href(replaysHref(query, data.tab))}`);
	const user = $derived(page.data.user);
	const mySteamIds = $derived(meSteamIds(user));
	const uploadHref = $derived(href(uploadReplayPath(!!user)));
	const quick = $derived<ArchiveQuickFilters>({
		matchups: query.matchups,
		ranked: query.ranked,
		pro: query.pro
	});
	/** Filters the chip bar does not show. */
	const advancedActive = $derived(
		query.filter != null ||
			query.maps.length > 0 ||
			query.playerIds.length > 0 ||
			query.races.length > 0 ||
			query.positions.length > 0 ||
			query.elo != null ||
			query.duration != null
	);

	const views = $derived.by(() => {
		const items: { id: ReplaysView; label: string; href: string }[] = [
			{ id: 'discover', label: t('Discover'), href: href('/replays') },
			{
				id: 'community',
				label: t('Community matches'),
				href: href(replaysHref({ ...query, page: 1 }, 'community'))
			}
		];
		if (user) {
			items.push({
				id: 'mine',
				label: t('My matches'),
				href: href(replaysHref({ ...query, page: 1 }, 'mine'))
			});
		}

		return items;
	});

	watch(
		() => data.shareCandidates,
		(promise) => {
			shareCandidates = null;
			void promise.then((value) => {
				if (data.shareCandidates === promise) {
					shareCandidates = value;
				}
			});
		}
	);

	beforeNavigate(() => {
		if (data.tab !== 'discover') {
			rememberReplaysListHref(replaysHref(query, data.tab));
		}

		filtersOpen = false;
	});

	function apply(patch: Partial<ReplaysQuery>) {
		const next: ReplaysQuery = { ...query, ...patch, page: patch.page ?? 1 };
		void goto(href(replaysHref(next, data.tab === 'mine' ? 'mine' : 'community')), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}

	function toggleSort(field: HistorySortField) {
		if (query.sort === field) {
			apply({ sort: field, sortDir: query.sortDir === 'desc' ? 'asc' : 'desc' });
			return;
		}

		apply({ sort: field, sortDir: 'desc' });
	}

	/** Community matches of one game type (a section's "View all" or its chip). */
	function matchupHref(matchup: HistoryMatchup) {
		return href(replaysHref({ ...query, matchups: [matchup], filter: null, page: 1 }, 'community'));
	}

	async function loadMoreShared(nextPage: number) {
		return getSharedReplaysPage({ page: nextPage });
	}

	const seoTitle = $derived(
		tab === 'discover' ? t('Replays') : tab === 'mine' ? t('My matches') : t('Community matches')
	);
</script>

<Seo
	title={seoTitle}
	ogTitle={t('CoH community replays')}
	description={t(
		'Watch the best Company of Heroes replays of the community: featured games, pro 1v1s, big battles and replays shared by players. Download and watch them in the game.'
	)}
	url={canonical}
/>

<ReplaysPage {views} active={tab} {uploadHref}>
	{#snippet aside()}
		{#if tab !== 'discover' && data.result}
			{#await data.result}
				<Skeleton class="h-9 w-56" />
			{:then result}
				<Pagination
					page={query.page}
					count={result.totalItems}
					perPage={REPLAYS_PER_PAGE}
					pageNumberLabel={t('Page number')}
					onPage={(nextPage) => apply({ page: nextPage })}
				/>
			{:catch}
				<!-- keep the layout stable when the list fails -->
			{/await}
		{/if}
	{/snippet}

	{#if tab === 'discover'}
		{#await data.discover}
			<DiscoverView
				data={null}
				{shareCandidates}
				shareHref={(match) => href(`/replays/upload?fromMatch=${match.id}`)}
				themeHref={(theme) =>
					href(
						replaysHref({ ...recentCommunityQuery(), ...themeArchiveQuery(theme) }, 'community')
					)}
				{loadMoreShared}
				{uploadHref}
				meSteamIds={mySteamIds}
			/>
		{:then discover}
			<DiscoverView
				data={discover}
				{shareCandidates}
				shareHref={(match) => href(`/replays/upload?fromMatch=${match.id}`)}
				themeHref={(theme) =>
					href(
						replaysHref({ ...recentCommunityQuery(), ...themeArchiveQuery(theme) }, 'community')
					)}
				{loadMoreShared}
				{uploadHref}
				meSteamIds={mySteamIds}
			/>
		{:catch}
			<div class="flex min-h-48 items-center justify-center px-4 py-8">
				<p class="text-secondary-400 text-center text-sm">
					{t('Failed to load community replays. Please try again later.')}
				</p>
			</div>
		{/await}
	{:else}
		<ArchiveFilterBar
			value={quick}
			onChange={(next) => apply({ ...next, filter: null })}
			sort={query.sort}
			sortDir={query.sortDir}
			onSortChange={({ sort, sortDir }) => apply({ sort, sortDir })}
			onOpenFilters={() => (filtersOpen = true)}
			{advancedActive}
		/>
		<div class="min-w-0 flex-1 overflow-x-hidden">
			{#if data.groups && !switching}
				{#await data.groups}
					<MatchupSections groups={null} viewAllHref={matchupHref} />
				{:then groups}
					<MatchupSections {groups} viewAllHref={matchupHref} meSteamIds={mySteamIds} />
				{:catch}
					<p class="text-secondary-400 px-4 py-10 text-center text-sm">
						{t('Failed to load community replays. Please try again later.')}
					</p>
				{/await}
			{:else if switching || !data.result}
				{#if tab === 'community'}
					<ReplayCardGrid matches={[]} skeletons={8} />
				{:else}
					<ReplayListSkeleton />
				{/if}
			{:else}
				{#await data.result}
					{#if tab === 'community'}
						<ReplayCardGrid matches={[]} skeletons={8} />
					{:else}
						<ReplayListSkeleton />
					{/if}
				{:then result}
					{#if tab === 'community'}
						{#if result.items.length === 0}
							<p class="text-secondary-400 px-4 py-10 text-center text-sm">
								{t('No community replays found.')}
							</p>
						{:else}
							<ReplayCardGrid matches={result.items} meSteamIds={mySteamIds} closing />
						{/if}
					{:else}
						<ReplayList
							matches={result.items}
							highlightedPlayers={query.playerIds}
							meSteamIds={mySteamIds}
							sort={query.sort}
							sortDir={query.sortDir}
							onSort={toggleSort}
							emptyMessage={t('No matches found.')}
						/>
					{/if}
					<div class="border-secondary-800 flex border-t px-5 py-3">
						<Pagination
							class="ms-auto"
							page={query.page}
							count={result.totalItems}
							perPage={REPLAYS_PER_PAGE}
							pageNumberLabel={t('Page number')}
							onPage={(nextPage) => apply({ page: nextPage })}
						/>
					</div>
				{:catch error}
					<div class="flex min-h-48 items-center justify-center px-4 py-8">
						<p class="text-secondary-400 text-center text-sm">
							{error?.message ?? t('Failed to load community replays. Please try again later.')}
						</p>
					</div>
				{/await}
			{/if}
		</div>
	{/if}
</ReplaysPage>

<Sheet bind:open={filtersOpen} side="left" title={t('Filters')} closeLabel={t('Close')}>
	{#await data.maps}
		<ReplayFilters
			{query}
			maps={[]}
			scope={tab === 'mine' ? 'user' : 'community'}
			onChange={apply}
		/>
	{:then maps}
		<ReplayFilters {query} {maps} scope={tab === 'mine' ? 'user' : 'community'} onChange={apply} />
	{/await}
</Sheet>
