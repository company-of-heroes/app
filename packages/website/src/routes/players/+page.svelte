<script lang="ts">
	import CardForm from '$lib/components/player/card-form.svelte';
	import { PlayerSearchCard } from '@company-of-heroes/ui/player';
	import { Alert } from '@company-of-heroes/ui/alert';
	import { SITE_URL } from '$lib/site/urls';
	import { flagImageUrl, profileHref, resolveAvatarUrl } from '$lib/utils/resolvers';
	import { href, useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
	const results = $derived(data.results);
</script>

<svelte:head>
	<title>{t('Players')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t('Look up Company of Heroes player stats by name, Steam ID, or Relic profile id.')}
	/>
	<meta property="og:url" content="{SITE_URL}{href('/players')}" />
	<meta property="og:title" content={t('CoH Player Stats')} />
</svelte:head>

<CardForm initialQuery={data.query} class="py-2" />

{#if data.error}
	<div class="border-secondary-800 border-b px-4 py-3">
		<Alert variant="destructive">{t(data.error)}</Alert>
	</div>
{/if}

{#if data.query && !data.error}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{results.length === 1
			? t('{count} player found', { count: results.length })
			: t('{count} players found', { count: results.length })}
	</p>
	{#if results.length === 0}
		<p class="text-secondary-400 px-4 py-3 text-sm">{t('Player not found')}</p>
	{:else}
		<div>
			{#each results as player (player.profileId)}
				<PlayerSearchCard
					{player}
					href={profileHref(player.profileId)}
					flagSrc={flagImageUrl(player.country)}
					{resolveAvatarUrl}
					steamIdLabel={t('Steam ID:')}
					profileIdLabel={t('Profile ID:')}
				/>
			{/each}
		</div>
	{/if}
{/if}
