<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import ReplayTable from '../replay/replay-table.svelte';
	import ReplayTableSkeleton from '../replay/replay-table-skeleton.svelte';
	import type { CommunityMatch, ReplayLayout } from '../replay/types';
	import DiscoverSectionHeader from './discover-section-header.svelte';
	import FeaturedHero from './featured-hero.svelte';
	import LatestShared from './latest-shared.svelte';
	import ReplayCardGrid from './replay-card-grid.svelte';
	import ShareStrip from './share-strip.svelte';
	import type { DiscoverThemeId, ReplayDiscoverData, ReplayPage } from './types';

	type Props = {
		/** null while loading. */
		data: ReplayDiscoverData | null;
		/** The viewer's unshared recent games; null when signed out or still loading. */
		shareCandidates?: CommunityMatch[] | null;
		shareHref: (match: CommunityMatch) => string;
		/** The archive filtered to a theme ("View all"). */
		themeHref: (theme: DiscoverThemeId) => string;
		loadMoreShared: (page: number) => Promise<ReplayPage>;
		uploadHref: string;
		meSteamIds?: string[];
		/** Cards (default) or table rows for the featured picks and every section. */
		layout?: ReplayLayout;
	};

	const { t } = useI18n();

	let {
		data,
		shareCandidates = null,
		shareHref,
		themeHref,
		loadMoreShared,
		uploadHref,
		meSteamIds = [],
		layout = 'grid'
	}: Props = $props();

	type Theme = {
		title: string;
		description: string;
	};

	const themes = $derived<Record<DiscoverThemeId, Theme>>({
		'pro-1v1': {
			title: t('Pro 1v1s'),
			description: t('Duels between the best players of the month')
		},
		'big-battles': {
			title: t('Big battles'),
			description: t('3v3 and 4v4 games of half an hour or more')
		},
		fast: {
			title: t('Decided fast'),
			description: t('Games won in under 12 minutes')
		},
		discussed: {
			title: t('Most discussed'),
			description: t('Replays the community is talking about')
		}
	});
</script>

{#if shareCandidates && shareCandidates.length > 0}
	<ShareStrip matches={shareCandidates} {meSteamIds} {shareHref} />
{/if}

{#if !data && layout === 'list'}
	<DiscoverSectionHeader title={t('Featured')} />
	<ReplayTableSkeleton rowCount={6} />
{:else if !data}
	<FeaturedHero matches={[]} loading />
	<DiscoverSectionHeader title={t('Latest shared')} />
	<ReplayCardGrid matches={[]} skeletons={6} rows={1} closing />
{:else}
	{#if layout === 'list'}
		{#if data.featured.length > 0}
			<section>
				<DiscoverSectionHeader title={t('Featured')} />
				<ReplayTable matches={data.featured.slice(0, 3)} {meSteamIds} closing={false} />
			</section>
		{/if}
	{:else}
		<FeaturedHero matches={data.featured} {meSteamIds} />
	{/if}
	{#each data.sections as section (section.id)}
		{@const theme = themes[section.id]}
		<section>
			<DiscoverSectionHeader
				title={theme.title}
				description={theme.description}
				href={themeHref(section.id)}
			/>
			{#if layout === 'list'}
				<ReplayTable matches={section.items} {meSteamIds} closing={false} />
			{:else}
				<ReplayCardGrid matches={section.items} {meSteamIds} rows={1} />
			{/if}
		</section>
	{/each}
	{#key data.latestShared}
		<LatestShared
			initial={data.latestShared}
			loadMore={loadMoreShared}
			{uploadHref}
			{meSteamIds}
			{layout}
		/>
	{/key}
{/if}
