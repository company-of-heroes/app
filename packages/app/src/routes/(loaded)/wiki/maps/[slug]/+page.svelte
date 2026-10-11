<script lang="ts">
	import { page } from '$app/state';
	import { DocsMapPage } from '@company-of-heroes/ui/docs';
	import { getWikiMapImage } from '$lib/utils/wiki-maps';
	import { wiki } from '$lib/wiki/docs';
	import WikiPage from '$lib/wiki/wiki-page.svelte';

	const slug = $derived(page.params.slug ?? '');
</script>

<WikiPage key={slug} load={() => wiki.map(slug)}>
	{#snippet children(data)}
		<DocsMapPage page={data} image={getWikiMapImage} />
	{/snippet}
</WikiPage>
