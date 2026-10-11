<script lang="ts">
	import { DocsMapList } from '@company-of-heroes/ui/docs';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import { getWikiMapImage } from '$lib/utils/media/wiki-maps';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<svelte:head>
	<title>{t('Maps')} | {t('Wiki')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t(
			'Every Company of Heroes map: victory points, fuel and munition points, territory sectors and starting positions.'
		)}
	/>
	<meta property="og:url" content="{SITE_URL}{href('/wiki/maps')}" />
	<meta property="og:title" content={t('CoH maps')} />
</svelte:head>

<DocsMapList maps={data.maps} image={getWikiMapImage} />
