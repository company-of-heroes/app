<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { Pagination } from '@company-of-heroes/ui/pagination';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { Button } from '@company-of-heroes/ui/button';
	import {
		List as ReplayList,
		ListSkeleton as ReplayListSkeleton,
		SectionTabs as ReplaySectionTabs
	} from '@company-of-heroes/ui/replay';
	import ReplayFilters from '$lib/components/replay/replay-filters.svelte';
	import {
		normalizeMapName,
		replayHref,
		resolveFactionFlag,
		resolveMapSrc,
		resolvePlayerHref
	} from '$lib/utils/resolvers';
	import {
		REPLAYS_PER_PAGE,
		rememberReplaysListHref,
		replaysHref,
		type HistorySortField,
		type ReplaysListTab,
		type ReplaysQuery
	} from '$lib/replays';
	import { href, unlocalizedPath, currentLocale, useI18n } from '$lib/i18n';
	import { meSteamIds } from '$lib/auth/user';
	import { SITE_URL } from '$lib/site/urls';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const query = $derived(data.query);
	const tab = $derived(data.tab as ReplaysListTab);
	const switching = $derived(unlocalizedPath(navigating.to?.url.pathname ?? '') === '/replays');
	const canonical = $derived(`${SITE_URL}${href(replaysHref(query, tab))}`);
	const user = $derived(page.data.user);
	const mySteamIds = $derived(meSteamIds(user));

	const tabs = $derived.by(() => {
		const items = [
			{ id: 'community', label: t('Community matches'), href: href(replaysHref(query, 'community')) },
			{ id: 'member', label: t('Member replays'), href: href(replaysHref(query, 'member')) }
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

	const emptyMessage = $derived.by(() => {
		if (tab === 'member') {
			return t('No member replays found.');
		}
		if (tab === 'mine') {
			return t('No matches found.');
		}
		return t('No community replays found.');
	});

	beforeNavigate(() => {
		rememberReplaysListHref(replaysHref(query, tab));
	});

	function apply(patch: Partial<ReplaysQuery>) {
		const next: ReplaysQuery = {
			...query,
			...patch,
			page: patch.page ?? 1
		};
		void goto(href(replaysHref(next, tab)), {
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

	const nameColumnLabel = $derived(tab === 'member' ? t('Title') : t('Map'));
</script>

{#snippet listSkeleton()}
	<ReplayListSkeleton
		mapLabel={nameColumnLabel}
		alliesLabel={t('Allies')}
		axisLabel={t('Axis')}
		durationLabel={t('Duration')}
		likesLabel={t('Likes')}
		commentsLabel={t('Comments')}
		downloadsLabel={t('Downloads')}
		dateLabel={t('Date')}
	/>
{/snippet}

<svelte:head>
	<title>{t('Replays')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t(
			'Browse community Company of Heroes replays and member uploads. Filter by ranked, mode, map, and player, then open overview, chat, and timeline.'
		)}
	/>
	<meta property="og:url" content={canonical} />
	<meta property="og:title" content={t('CoH community replays')} />
</svelte:head>

<div class="border-secondary-800 border-b">
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
		<div class="flex flex-wrap items-center gap-3">
			<h1 class="font-heading text-xl font-bold text-white">{t('Replays')}</h1>
			{#if user}
				<Button href={href('/replays/upload')} variant="secondary" size="sm"
					>{t('Upload replay')}</Button
				>
			{:else}
				<Button
					href={href(`/login?redirect=${encodeURIComponent('/replays/upload')}`)}
					variant="secondary"
					size="sm"
				>
					{t('Upload replay')}
				</Button>
			{/if}
		</div>
		{#await data.result}
			<Skeleton class="ms-auto h-9 w-56 shrink-0" />
		{:then result}
			{#if result}
				<Pagination
					class="ms-auto shrink-0"
					page={query.page}
					count={result.totalItems}
					perPage={REPLAYS_PER_PAGE}
					pageNumberLabel={t('Page number')}
					onPage={(nextPage) => apply({ page: nextPage })}
				/>
			{/if}
		{/await}
	</div>
	<ReplaySectionTabs {tabs} active={tab} />
	<div class="border-secondary-800 flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
		{#await data.maps}
			<ReplayFilters
				{query}
				maps={[]}
				scope={tab === 'mine' ? 'user' : 'community'}
				userId={tab === 'mine' ? user?.id : undefined}
				onChange={apply}
			/>
		{:then maps}
			<ReplayFilters
				{query}
				{maps}
				scope={tab === 'mine' ? 'user' : 'community'}
				userId={tab === 'mine' ? user?.id : undefined}
				onChange={apply}
			/>
		{/await}
	</div>
</div>

{#if switching}
	{@render listSkeleton()}
{:else if data.result}
	{#await data.result}
		{@render listSkeleton()}
	{:then result}
		<ReplayList
			matches={result.items}
			highlightedPlayers={query.playerIds}
			meSteamIds={mySteamIds}
			sort={query.sort}
			sortDir={query.sortDir}
			onSort={toggleSort}
			{replayHref}
			playerHref={resolvePlayerHref}
			{resolveMapSrc}
			{resolveFactionFlag}
			formatMapName={normalizeMapName}
			{emptyMessage}
			locale={currentLocale()}
			mapLabel={nameColumnLabel}
			alliesLabel={t('Allies')}
			axisLabel={t('Axis')}
			durationLabel={t('Duration')}
			likesLabel={t('Likes')}
			commentsLabel={t('Comments')}
			downloadsLabel={t('Downloads')}
			dateLabel={t('Date')}
			sortByLabel={t('Sort by {label}')}
			deletedLabel={t('Deleted')}
		/>
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
	{/await}
{/if}
