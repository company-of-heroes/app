<script lang="ts">
	import Hero from '../components/Hero.svelte';
	import FeatureSection from '../components/FeatureSection.svelte';
	import DownloadSection from '../components/DownloadSection.svelte';
	import { features } from '$lib/features';
	import { loadLatestDownload } from '$lib/download.svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		void loadLatestDownload();
	});
</script>

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
