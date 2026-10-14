<script lang="ts">
	import { DocsCommanderPage } from '@company-of-heroes/ui/docs';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import { breadcrumbList } from '$lib/site/seo';
	import { getActionIcon } from '$lib/utils/media/action-icons';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const page = $derived(data.page);
	const description = $derived(page.commander.help ?? '');
	const image = $derived(page.commander.icon ? getActionIcon(page.commander.icon) : undefined);
	const jsonLd = $derived(
		breadcrumbList([
			{ name: t('Wiki'), href: href('/wiki') },
			{ name: page.commander.name, href: href(`/wiki/commanders/${page.commander.slug}`) }
		])
	);
</script>

<Seo
	title="{page.commander.name} | {t('Wiki')}"
	ogTitle={page.commander.name}
	description={description || undefined}
	{image}
	{jsonLd}
/>

<DocsCommanderPage {page} />
