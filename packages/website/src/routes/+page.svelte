<script lang="ts">
	import Hero from '$lib/components/home/hero.svelte';
	import HomePlayerSearch from '$lib/components/home/home-player-search.svelte';
	import HomeLiveLobbies from '$lib/components/home/home-live-lobbies.svelte';
	import HomeRecentMatches from '$lib/components/home/home-recent-matches.svelte';
	import HomeMemberUploads from '$lib/components/home/home-member-uploads.svelte';
	import HomeLiveStreams from '$lib/components/home/home-live-streams.svelte';
	import DonationSection from '$lib/components/home/donation-section.svelte';
	import { SITE_URL } from '$lib/site/urls';
	import { href, useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const title = $derived(t('Company of Heroes 1 Stats'));
	const description = $derived(
		t(
			'Company of Heroes 1 player stats, Relic leaderboards, community replays, live companion lobbies, and Twitch streams. Free desktop companion for scouting and fair play.'
		)
	);
	const canonical = $derived(`${SITE_URL}${href('/')}`);
	const searchUrl = $derived(`${SITE_URL}${href('/players')}?q={search_term_string}`);
	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: 'coh1stats',
			alternateName: title,
			url: canonical,
			description,
			potentialAction: {
				'@type': 'SearchAction',
				target: {
					'@type': 'EntryPoint',
					urlTemplate: searchUrl
				},
				'query-input': 'required name=search_term_string'
			}
		})
	);
</script>

<svelte:head>
	<title>{title} | coh1stats.com</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonical} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content="{SITE_URL}/og-image.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content="{SITE_URL}/og-image.png" />
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<main>
	<Hero />
	<HomePlayerSearch />
	<HomeLiveLobbies
		lobbies={data.liveLobbies.items}
		error={data.liveLobbies.error}
	/>
	<HomeRecentMatches matches={data.recentMatches.items} error={data.recentMatches.error} />
	<HomeMemberUploads
		matches={data.recentMemberUploads.items}
		error={data.recentMemberUploads.error}
	/>
	<HomeLiveStreams streams={data.streams} />
	<DonationSection />
</main>
