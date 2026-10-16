<script lang="ts">
	import { page } from '$app/state';
	import { isFaction } from '@company-of-heroes/game-data/factions';
	import { DocsOverview, DocsOverviewSkeleton } from '@company-of-heroes/ui/docs';
	import { wiki } from '$lib/wiki/docs';
	import WikiPage from '$lib/wiki/wiki-page.svelte';

	const param = $derived(page.url.searchParams.get('faction') ?? '');
	const faction = $derived(isFaction(param) ? param : 'allies');
</script>

<WikiPage key="overview" load={wiki.overview}>
	{#snippet skeleton()}
		<DocsOverviewSkeleton />
	{/snippet}
	{#snippet children(overview)}
		<DocsOverview {overview} {faction} />
	{/snippet}
</WikiPage>
