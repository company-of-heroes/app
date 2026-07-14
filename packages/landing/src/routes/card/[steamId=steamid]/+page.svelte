<script lang="ts">
	import { page } from '$app/state';
	import CardPageContent from '$lib/components/CardPageContent.svelte';
	import { SITE_URL } from '$lib/urls';
</script>

<svelte:head>
	<title>Player card | Company of Heroes - Companion</title>
	<meta
		name="description"
		content="Shareable Company of Heroes player card for Steam ID {page.params.steamId}."
	/>
	<meta property="og:url" content="{SITE_URL}/card/{page.params.steamId}" />
	<meta property="og:title" content="CoH Player Card" />
</svelte:head>

<CardPageContent steamId={page.params.steamId} />
