<script lang="ts">
	import { DocsCommanderPage } from '@company-of-heroes/ui/docs';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const page = $derived(data.page);
	const description = $derived(page.commander.help ?? '');
</script>

<svelte:head>
	<title>{page.commander.name} | {t('Wiki')} | {t('Company of Heroes 1 Stats')}</title
	>
	{#if description}
		<meta name="description" content={description} />
	{/if}
	<meta property="og:url" content="{SITE_URL}{href(`/wiki/commanders/${page.commander.slug}`)}" />
	<meta property="og:title" content={page.commander.name} />
</svelte:head>

<DocsCommanderPage {page} />
