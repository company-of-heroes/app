<script lang="ts">
	import Hero from '$lib/components/home/hero.svelte';
	import HomeStatistics from '$lib/components/home/home-statistics.svelte';
	import HomePlayerSearch from '$lib/components/home/home-player-search.svelte';
	import HomeLiveLobbies from '$lib/components/home/home-live-lobbies.svelte';
	import HomeRecentMatches from '$lib/components/home/home-recent-matches.svelte';
	import HomeMemberUploads from '$lib/components/home/home-member-uploads.svelte';
	import HomeTournaments from '$lib/components/home/home-tournaments.svelte';
	import HomeLiveStreams from '$lib/components/home/home-live-streams.svelte';
	import DonationSection from '$lib/components/home/donation-section.svelte';
	import TopReplays from '$lib/components/replay/top-replays.svelte';
	import { SITE_URL } from '$lib/site/urls';
	import { organization } from '$lib/site/seo';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const title = $derived(`COH1 Stats - ${t('Company of Heroes 1 Statistics')}`);
	const description = $derived(
		t(
			'Company of Heroes 1 player stats, Relic leaderboards, community replays, live companion lobbies, and Twitch streams. Free desktop companion for scouting and fair play.'
		)
	);
	const canonical = $derived(`${SITE_URL}${href('/')}`);
	const searchUrl = $derived(`${SITE_URL}${href('/players')}?q={search_term_string}`);
	const jsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: 'COH1 Stats',
			alternateName: t('Company of Heroes 1 Statistics'),
			url: canonical,
			description,
			publisher: organization,
			potentialAction: {
				'@type': 'SearchAction',
				target: {
					'@type': 'EntryPoint',
					urlTemplate: searchUrl
				},
				'query-input': 'required name=search_term_string'
			}
		},
		{ '@context': 'https://schema.org', ...organization }
	]);
</script>

<Seo {title} suffix={false} {description} {jsonLd} />

<main>
	<HomeTournaments {...data.tournaments} />
	<Hero />
	{#await data.statistics}
		<HomeStatistics statistics={null} loading />
	{:then statistics}
		<HomeStatistics {statistics} />
	{:catch}
		<HomeStatistics statistics={null} />
	{/await}
	<HomePlayerSearch />
	{#await data.topReplays}
		<TopReplays matches={[]} loading />
	{:then topReplays}
		<TopReplays matches={topReplays.items} error={topReplays.error} />
	{:catch}
		<TopReplays matches={[]} error={t('Could not load top replays.')} />
	{/await}
	{#await data.recentMatches}
		<HomeRecentMatches matches={[]} loading />
	{:then recentMatches}
		<HomeRecentMatches matches={recentMatches.items} error={recentMatches.error} />
	{:catch}
		<HomeRecentMatches matches={[]} error={t('Could not load recent matches.')} />
	{/await}
	{#await data.recentMemberUploads}
		<HomeMemberUploads matches={[]} loading />
	{:then recentMemberUploads}
		<HomeMemberUploads matches={recentMemberUploads.items} error={recentMemberUploads.error} />
	{:catch}
		<HomeMemberUploads matches={[]} error={t('Could not load member uploads.')} />
	{/await}
	{#await data.liveLobbies}
		<HomeLiveLobbies lobbies={[]} loading />
	{:then liveLobbies}
		<HomeLiveLobbies lobbies={liveLobbies.items} error={liveLobbies.error} />
	{:catch}
		<HomeLiveLobbies lobbies={[]} error={t('Could not load live lobbies.')} />
	{/await}
	{#await data.streams}
		<HomeLiveStreams streams={[]} loading />
	{:then streams}
		<HomeLiveStreams {streams} />
	{:catch}
		<HomeLiveStreams streams={[]} />
	{/await}
	<DonationSection />
</main>
