<script lang="ts">
	import { DocsWeaponList } from '@company-of-heroes/ui/docs';
	import { wiki } from '$lib/wiki/docs';
	import WikiPage from '$lib/wiki/wiki-page.svelte';
</script>

<WikiPage key="weapons" load={wiki.weapons}>
	{#snippet children(weapons)}
		<DocsWeaponList {weapons} />
	{/snippet}
</WikiPage>
