<script lang="ts">
	import { DocsMapList } from '@company-of-heroes/ui/docs';
	import { getWikiMapImage } from '$lib/utils/wiki-maps';
	import { wiki } from '$lib/wiki/docs';
	import WikiPage from '$lib/wiki/wiki-page.svelte';
</script>

<WikiPage key="maps" load={wiki.maps}>
	{#snippet children(maps)}
		<DocsMapList {maps} image={getWikiMapImage} />
	{/snippet}
</WikiPage>
