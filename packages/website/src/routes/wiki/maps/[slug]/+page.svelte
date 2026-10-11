<script lang="ts">
	import { DocsMapPage } from '@company-of-heroes/ui/docs';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import { getWikiMapImage } from '$lib/utils/media/wiki-maps';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const map = $derived(data.page.map);
	const image = $derived(getWikiMapImage(map.slug, 'full'));
</script>

<svelte:head>
	<title>{map.name} | {t('Maps')} | {t('Wiki')} | {t('Company of Heroes 1 Stats')}</title>
	{#if map.description}
		<meta name="description" content={map.description} />
	{/if}
	<meta property="og:url" content="{SITE_URL}{href(`/wiki/maps/${map.slug}`)}" />
	<meta property="og:title" content={map.name} />
	{#if image}
		<meta property="og:image" content="{SITE_URL}{image}" />
	{/if}
</svelte:head>

<DocsMapPage page={data.page} image={getWikiMapImage} />
