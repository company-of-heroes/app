<script lang="ts">
	import { DocsOverview } from '@company-of-heroes/ui/docs';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<Seo
	title={t('Wiki')}
	ogTitle={t('CoH unit wiki')}
	description={t(
		'Every Company of Heroes unit, building, commander and weapon: costs, stats, veterancy and when to use them.'
	)}
/>

<DocsOverview overview={data.overview} faction={data.faction} />
