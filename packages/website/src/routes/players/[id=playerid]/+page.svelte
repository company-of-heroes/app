<script lang="ts">
	import { PlayerProfile, PlayerProfileSkeleton } from '@company-of-heroes/ui/player';
	import { SITE_URL } from '$lib/site/urls';
	import { href, useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
	let currentTab = $state('stats');
</script>

<svelte:head>
	{#await data.player}
		<title>{t('Loading player')} | {t('Company of Heroes 1 Stats')}</title>
	{:then player}
		<title>{player.alias} | {t('Company of Heroes 1 Stats')}</title>
		<meta
			name="description"
			content={t(
				'Company of Heroes stats for {alias}: ranks, community performance, and recent matches.',
				{ alias: player.alias }
			)}
		/>
		<meta property="og:url" content="{SITE_URL}{href(`/players/${player.steamId}`)}" />
		<meta property="og:title" content="{player.alias} — {t('CoH player stats')}" />
	{/await}
</svelte:head>

{#await data.player}
	<PlayerProfileSkeleton />
{:then player}
	<PlayerProfile {player} bind:tab={currentTab} />
{/await}
