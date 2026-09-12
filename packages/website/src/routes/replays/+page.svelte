<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { Pagination } from '@company-of-heroes/ui/pagination';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { Button } from '@company-of-heroes/ui/button';
	import { Sheet } from '@company-of-heroes/ui/sheet';
	import {
		List as ReplayList,
		ListSkeleton as ReplayListSkeleton,
		SectionTabs as ReplaySectionTabs,
		Sort
	} from '@company-of-heroes/ui/replay';
	import ReplayFilters from '$lib/components/replay/replay-filters.svelte';
	import {
		normalizeMapName,
		replayHref,
		resolveFactionFlag,
		resolveMapSrc,
		resolvePlayerHref,
		getRankImageByRace
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
	import FunnelSimpleIcon from 'phosphor-svelte/lib/FunnelSimpleIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	let filtersOpen = $state(false);

	const query = $derived(data.query);
	const tab = $derived(data.tab as ReplaysListTab);
	const switching = $derived(unlocalizedPath(navigating.to?.url.pathname ?? '') === '/replays');
	const canonical = $derived(`${SITE_URL}${href(replaysHref(query, tab))}`);
	const user = $derived(page.data.user);
	const mySteamIds = $derived(meSteamIds(user));
	const uploadHref = $derived(
		user
			? href('/replays/upload')
			: href(`/login?redirect=${encodeURIComponent('/replays/upload')}`)
	);
	const filtersActive = $derived(query.filter != null);

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
		filtersOpen = false;
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
		typeLabel={t('Type')}
		alliesLabel={t('Allies')}
		axisLabel={t('Axis')}
		durationLabel={t('Duration')}
		dateLabel={t('Date')}
	/>
{/snippet}

{#snippet filtersButton()}
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

<div class="flex min-h-0 flex-1 flex-col">
	<div>
		<div class="border-secondary-800 flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
			<h1 class="font-heading text-xl font-bold text-white">{t('Replays')}</h1>
			<Button href={uploadHref} variant="primary" size="sm">
				<UploadSimpleIcon class="size-4" />
				{t('Upload replay')}
			</Button>
		</div>
		<ReplaySectionTabs {tabs} active={tab}>
			{#snippet trailing()}
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
				{:catch _}
					<!-- keep layout stable when pagination promise rejects -->
				{/await}
			{/snippet}
		</ReplaySectionTabs>
		<div class="border-secondary-800 flex items-center justify-end gap-2 border-b px-4 py-2">
			<Sort
				sort={query.sort}
				sortDir={query.sortDir}
				onChange={({ sort, sortDir }) => apply({ sort, sortDir })}
				dateLabel={t('Date')}
				likesLabel={t('Likes')}
				downloadsLabel={t('Downloads')}
				commentsLabel={t('Comments')}
				ascendingLabel={t('Ascending')}
				descendingLabel={t('Descending')}
			/>
			{@render filtersButton()}
		</div>
		{#if tab === 'member'}
			<div
				class="border-secondary-800 from-secondary-950 to-secondary-900/80 flex flex-wrap items-center justify-between gap-3 border-b bg-linear-to-r px-4 py-3"
			>
				<div class="min-w-0">
					<p class="font-medium text-white">{t('Share your replay')}</p>
					<p class="text-secondary-400 mt-0.5 text-sm">
						{t('Upload a .rec file to Member replays so others can watch your games.')}
					</p>
				</div>
				<Button href={uploadHref} variant="primary">
					<UploadSimpleIcon class="size-4" />
					{t('Upload replay')}
				</Button>
			</div>
		{/if}
	</div>

	<div class="min-w-0 flex-1 overflow-x-hidden">
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
					getRankImage={getRankImageByRace}
					formatMapName={normalizeMapName}
					{emptyMessage}
					locale={currentLocale()}
					mapLabel={nameColumnLabel}
					typeLabel={t('Type')}
					alliesLabel={t('Allies')}
					axisLabel={t('Axis')}
					durationLabel={t('Duration')}
					likesLabel={t('Likes')}
					commentsLabel={t('Comments')}
					downloadsLabel={t('Downloads')}
					dateLabel={t('Date')}
					sortByLabel={t('Sort by {label}')}
					deletedLabel={t('Deleted')}
					proLabel={t('Pro')}
					proTooltipLabel={(elo) => t('Pro gameplay · avg {elo} ELO', { elo })}
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
			{:catch error}
				<div class="flex min-h-48 items-center justify-center px-4 py-8">
					<p class="text-secondary-400 text-center text-sm">
						{error?.message ??
							t('Failed to load community replays. Please try again later.')}
					</p>
				</div>
			{/await}
		{/if}
	</div>
</div>

<Sheet bind:open={filtersOpen} side="left" title={t('Filters')} closeLabel={t('Close')}>
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
</Sheet>
