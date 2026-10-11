<script lang="ts">
	import { page } from '$app/state';
	import { DocsCommanderPage } from '@company-of-heroes/ui/docs';
	import { wiki } from '$lib/wiki/docs';
	import WikiPage from '$lib/wiki/wiki-page.svelte';

	const slug = $derived(page.params.slug ?? '');
</script>

<WikiPage key={slug} load={() => wiki.commander(slug)}>
	{#snippet children(data)}
		<DocsCommanderPage page={data} />
	{/snippet}
</WikiPage>
