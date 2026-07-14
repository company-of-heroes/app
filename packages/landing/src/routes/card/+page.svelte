<script lang="ts">
	import CardPageContent from '$lib/components/CardPageContent.svelte';
	import { SITE_URL } from '$lib/urls';
</script>

<svelte:head>
	<title>Player card | Company of Heroes - Companion</title>
	<meta
		name="description"
		content="Generate a shareable Company of Heroes player card from your Steam ID64."
	/>
	<meta property="og:url" content="{SITE_URL}/card" />
	<meta property="og:title" content="CoH Player Card Generator" />
</svelte:head>

<CardPageContent />
