<script lang="ts">
	import { DocsMapList } from '@company-of-heroes/ui/docs';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';
	import { getWikiMapImage } from '$lib/utils/media/wiki-maps';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<Seo
	title="{t('Maps')} | {t('Wiki')}"
	ogTitle={t('CoH maps')}
	description={t(
		'Every Company of Heroes map: victory points, fuel and munition points, territory sectors and starting positions.'
	)}
/>

<DocsMapList maps={data.maps} image={getWikiMapImage} />
