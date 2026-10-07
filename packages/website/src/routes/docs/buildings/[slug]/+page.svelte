<script lang="ts">
	import { DocsBuildingPage } from '@company-of-heroes/ui/docs';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const page = $derived(data.page);
	const description = $derived(page.building.help ?? '');
</script>

<svelte:head>
	<title>{page.building.name} | {t('Unit documentation')} | {t('Company of Heroes 1 Stats')}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
	<meta property="og:url" content="{SITE_URL}{href(`/docs/buildings/${page.building.slug}`)}" />
	<meta property="og:title" content={page.building.name} />
</svelte:head>

<DocsBuildingPage {page} />
