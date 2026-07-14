<script lang="ts">
	import CardForm from '../components/CardForm.svelte';
	import ShareablePlayerCard from '../components/ShareablePlayerCard.svelte';
	import CardActions from '../components/CardActions.svelte';
	import { loadPlayerCard, playerCardState, resetPlayerCard } from '$lib/player-card.svelte';
	import { parseCardSteamId, routerState } from '$lib/router.svelte';

	let cardElement = $state<HTMLElement | null>(null);

	const steamIdFromRoute = $derived(parseCardSteamId(routerState.pathname));

	$effect(() => {
		const steamId = steamIdFromRoute;
		if (!steamId) {
			resetPlayerCard();
			return;
		}
		void loadPlayerCard(steamId);
	});
</script>

<section class="mx-auto max-w-5xl px-6 py-16">
	<div class="mx-auto mb-10 max-w-2xl text-center">
		<p class="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">Share your stats</p>
		<h1 class="text-3xl text-white sm:text-4xl">Generate your player card</h1>
		<p class="text-secondary-400 mt-4 text-lg">
			Enter your Steam ID64 to create a shareable Company of Heroes profile card with ranked stats.
		</p>
	</div>

	<CardForm initialSteamId={steamIdFromRoute ?? ''} />

	{#if playerCardState.loading}
		<div class="mt-10 flex flex-col items-center gap-4">
			<div
				class="border-primary/30 border-t-primary size-10 animate-spin rounded-full border-4"
			></div>
			<p class="text-secondary-400 text-sm">Loading player card…</p>
		</div>
	{:else if playerCardState.error}
		<div
			class="border-red-500/30 bg-red-500/10 mt-10 rounded-xl border p-4 text-center text-sm text-red-200"
		>
			{playerCardState.error}
		</div>
	{:else if playerCardState.data}
		<div class="mt-10 flex flex-col items-center gap-6">
			<ShareablePlayerCard bind:ref={cardElement} data={playerCardState.data} />
			<CardActions cardElement={cardElement} data={playerCardState.data} />
		</div>
	{/if}
</section>
