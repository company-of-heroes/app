<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import type { CommunityMatch } from '../replay/types';
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
	};

	const { t } = useI18n();

	let {
		data,
		shareCandidates = null,
		shareHref,
		themeHref,
		loadMoreShared,
		uploadHref,
		meSteamIds = []
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

{#if !data}
	<FeaturedHero matches={[]} loading />
	<DiscoverSectionHeader title={t('Latest shared')} />
	<ReplayCardGrid matches={[]} skeletons={6} rows={1} closing />
{:else}
	<FeaturedHero matches={data.featured} {meSteamIds} />
	{#each data.sections as section (section.id)}
		{@const theme = themes[section.id]}
		<section>
			<DiscoverSectionHeader
				title={theme.title}
				description={theme.description}
				href={themeHref(section.id)}
			/>
			<ReplayCardGrid matches={section.items} {meSteamIds} rows={1} />
		</section>
	{/each}
	{#key data.latestShared}
		<LatestShared initial={data.latestShared} loadMore={loadMoreShared} {uploadHref} {meSteamIds} />
	{/key}
{/if}
