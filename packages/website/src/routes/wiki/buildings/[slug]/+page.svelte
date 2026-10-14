<script lang="ts">
	import { DocsBuildingPage } from '@company-of-heroes/ui/docs';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import { breadcrumbList } from '$lib/site/seo';
	import { getActionIcon } from '$lib/utils/media/action-icons';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const page = $derived(data.page);
	const description = $derived(page.building.help ?? '');
	const image = $derived(page.building.icon ? getActionIcon(page.building.icon) : undefined);
	const jsonLd = $derived(
		breadcrumbList([
			{ name: t('Wiki'), href: href('/wiki') },
			{ name: page.building.name, href: href(`/wiki/buildings/${page.building.slug}`) }
		])
	);
</script>

<Seo
	title="{page.building.name} | {t('Wiki')}"
	ogTitle={page.building.name}
	description={description || undefined}
	{image}
	{jsonLd}
/>

<DocsBuildingPage {page} />
