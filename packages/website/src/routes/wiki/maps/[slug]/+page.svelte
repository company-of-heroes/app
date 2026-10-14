<script lang="ts">
	import { DocsMapPage } from '@company-of-heroes/ui/docs';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import { breadcrumbList } from '$lib/site/seo';
	import { getWikiMapImage } from '$lib/utils/media/wiki-maps';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const map = $derived(data.page.map);
	const image = $derived(getWikiMapImage(map.slug, 'full'));
	const jsonLd = $derived(
		breadcrumbList([
			{ name: t('Wiki'), href: href('/wiki') },
			{ name: t('Maps'), href: href('/wiki/maps') },
			{ name: map.name, href: href(`/wiki/maps/${map.slug}`) }
		])
	);
</script>

<Seo
	title="{map.name} | {t('Maps')} | {t('Wiki')}"
	ogTitle={map.name}
	description={map.description || undefined}
	image={image || undefined}
	{jsonLd}
/>

<DocsMapPage page={data.page} image={getWikiMapImage} />
