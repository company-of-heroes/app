<script lang="ts">
	import { Catalog as RewardCatalog } from '@company-of-heroes/ui/reward';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<Seo
	title="{t('Rewards')} | {t('Wiki')}"
	ogTitle={t('CoH rewards')}
	description={t('Every Company of Heroes 1 Stats ribbon and reward, and what unlocks it.')}
/>

<RewardCatalog rewards={data.rewards} player={data.player} />
