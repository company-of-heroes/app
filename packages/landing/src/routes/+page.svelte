<script lang="ts">
	import Hero from '$lib/components/Hero.svelte';
	import FeatureSection from '$lib/components/FeatureSection.svelte';
	import DownloadSection from '$lib/components/DownloadSection.svelte';
	import { features } from '$lib/features';
	import { SITE_URL } from '$lib/urls';
</script>

<svelte:head>
	<title>Company of Heroes - Companion | coh1stats.com</title>
	<meta
		name="description"
		content="Free desktop companion for Company of Heroes — replay analysis, match history, leaderboards, keybindings, and Twitch streaming tools."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/" />
	<meta property="og:title" content="Company of Heroes - Companion" />
	<meta
		property="og:description"
		content="Your command center for Company of Heroes. Replay analysis, match history, leaderboards, and Twitch tools — all in one free desktop app."
	/>
	<meta property="og:image" content="{SITE_URL}/og-image.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Company of Heroes - Companion" />
	<meta
		name="twitter:description"
		content="Your command center for Company of Heroes. Replay analysis, match history, leaderboards, and Twitch tools."
	/>
	<meta name="twitter:image" content="{SITE_URL}/og-image.png" />
</svelte:head>

<main>
	<Hero />
	<section id="features" class="border-secondary-800/80 border-t">
		<div class="mx-auto flex max-w-6xl flex-col gap-24 px-6 py-20">
			<div class="mx-auto max-w-2xl text-center">
				<p class="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
					Everything in one place
				</p>
				<h2 class="text-3xl text-white sm:text-4xl">Built for players who take CoH seriously</h2>
				<p class="text-secondary-400 mt-4 text-lg">
					From replay review to live lobbies and Twitch overlays — the companion runs alongside
					the game so you stay in the fight.
				</p>
			</div>
			{#each features as feature, index (feature.id)}
				<FeatureSection {feature} reversed={index % 2 === 1} />
			{/each}
		</div>
	</section>
	<DownloadSection />
</main>
