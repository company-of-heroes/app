<script lang="ts">
	import Header from './components/Header.svelte';
	import Footer from './components/Footer.svelte';
	import Home from './pages/Home.svelte';
	import Card from './pages/Card.svelte';
	import { initRouter, isCardRoute, routerState } from '$lib/router.svelte';
	import { onMount } from 'svelte';

	onMount(() => {
		initRouter();
	});

	const showCard = $derived(isCardRoute(routerState.pathname));
</script>

<div class="bg-secondary-950 min-h-screen font-sans">
	<Header />
	{#if showCard}
		<Card />
	{:else}
		<Home />
	{/if}
	<Footer />
</div>
