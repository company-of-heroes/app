<script lang="ts">
	import { DocsUnitPage } from '@company-of-heroes/ui/docs';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import { breadcrumbList } from '$lib/site/seo';
	import { getActionIcon } from '$lib/utils/media/action-icons';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const page = $derived(data.page);
	const description = $derived(page.unit.help ?? page.unit.extra ?? '');
	const image = $derived(page.unit.icon ? getActionIcon(page.unit.icon) : undefined);
	const jsonLd = $derived(
		breadcrumbList([
			{ name: t('Wiki'), href: href('/wiki') },
			{ name: page.unit.name, href: href(`/wiki/units/${page.unit.slug}`) }
		])
	);
</script>

<Seo
	title="{page.unit.name} | {t('Wiki')}"
	ogTitle={page.unit.name}
	description={description || undefined}
	{image}
	{jsonLd}
/>

<DocsUnitPage {page} />
