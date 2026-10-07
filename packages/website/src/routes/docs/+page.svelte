<script lang="ts">
	import { DocsOverview } from '@company-of-heroes/ui/docs';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<svelte:head>
	<title>{t('Unit documentation')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t(
			'Every Company of Heroes unit, building, commander and weapon: costs, stats, veterancy and when to use them.'
		)}
	/>
	<meta property="og:url" content="{SITE_URL}{href('/docs')}" />
	<meta property="og:title" content={t('CoH unit documentation')} />
</svelte:head>

<DocsOverview overview={data.overview} faction={data.faction} />
