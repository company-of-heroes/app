<script lang="ts">
	import { Catalog as RewardCatalog } from '@company-of-heroes/ui/reward';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<svelte:head>
	<title>{t('Rewards')} | {t('Wiki')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t('Every Company of Heroes 1 Stats ribbon and reward, and what unlocks it.')}
	/>
	<meta property="og:url" content="{SITE_URL}{href('/wiki/rewards')}" />
	<meta property="og:title" content={t('CoH rewards')} />
</svelte:head>

<RewardCatalog rewards={data.rewards} player={data.player} />
