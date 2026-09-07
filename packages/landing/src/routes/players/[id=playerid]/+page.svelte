<script lang="ts">
	import { page } from '$app/state';
	import { resource } from 'runed';
	import { Button } from '@company-of-heroes/ui/button';
	import PlayerMatchHistory from '$lib/components/player/player-match-history.svelte';
	import PlayerPerformancePanel from '$lib/components/player-performance/player-performance-panel.svelte';
	import PlayerCompanionStaffDebug from '$lib/components/player/player-companion-staff-debug.svelte';
	import PlayerLikeButton from '$lib/components/player/player-like-button.svelte';
	import PlayerProfileHeader from '$lib/components/player/player-profile-header.svelte';
	import PlayerProfileSkeleton from '$lib/components/player/player-profile-skeleton.svelte';
	import PlayerStatsTable from '$lib/components/player/player-stats-table.svelte';
	import { meSteamIds } from '$lib/auth/user';
	import { searchPlayers } from '$lib/remote/players.remote';
	import { formatRelative } from '$lib/utils/player/format';
	import { SITE_URL } from '$lib/site/urls';
	import { currentLocale, href, useI18n } from '$lib/i18n';
	import { tabTrigger } from '$lib/utils/variants';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
	let currentTab = $state<'stats' | 'performance' | 'match-history'>('stats');

	const mySteamIds = $derived(meSteamIds(page.data.user));
	const meProfileId = resource(
		() => mySteamIds[0] ?? null,
		async (steamId) => {
			if (!steamId) {
				return null;
			}

			const results = await searchPlayers({ q: steamId });
			return results[0]?.profileId ?? null;
		}
	);
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
	<div class="border-secondary-900 overflow-clip border-b">
		<PlayerProfileHeader {player}>
			{#snippet vote()}
				<PlayerLikeButton steamId={player.steamId} likeCount={player.likeCount ?? 0} />
			{/snippet}
			{#snippet afterName()}
				<Button href={href(`/compare?b=${player.profileId}`)} variant="secondary" size="sm">
					{t('Compare')}
				</Button>
				{#if meProfileId.current && meProfileId.current !== player.profileId}
					<Button
						href={href(`/compare?a=${meProfileId.current}&b=${player.profileId}`)}
						variant="secondary"
						size="sm"
					>
						{t('Compare with me')}
					</Button>
				{/if}
			{/snippet}
			{#snippet afterDetails()}
				<PlayerCompanionStaffDebug steamId={player.steamId} />
			{/snippet}
		</PlayerProfileHeader>
		<div class="border-secondary-800 border-b">
			<div class="flex min-w-0 flex-wrap items-center gap-2 px-4 py-2.5">
				<button
					type="button"
					class={tabTrigger}
					data-state={currentTab === 'stats' ? 'active' : undefined}
					onclick={() => (currentTab = 'stats')}
				>
					{t('Stats')}
				</button>
				<button
					type="button"
					class={tabTrigger}
					data-state={currentTab === 'performance' ? 'active' : undefined}
					onclick={() => (currentTab = 'performance')}
				>
					{t('Performance')}
				</button>
				<button
					type="button"
					class={tabTrigger}
					data-state={currentTab === 'match-history' ? 'active' : undefined}
					onclick={() => (currentTab = 'match-history')}
				>
					{t('Match history')}
				</button>
			</div>
			<div class="border-secondary-800 border-t">
				{#if currentTab === 'stats'}
					<PlayerStatsTable {player} />
				{:else if currentTab === 'performance'}
					<PlayerPerformancePanel {player} />
				{:else}
					<PlayerMatchHistory {player} />
				{/if}
			</div>
		</div>
		<div
			class="text-secondary-400 bg-secondary-950/50 flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-sm"
		>
			{#if player.lastlogoff}
				<span>
					<span class="text-secondary-500">{t('Last seen')}</span>
					{formatRelative(player.lastlogoff, currentLocale())}
				</span>
			{/if}
			{#if player.playtimeForever}
				<span>
					<span class="text-secondary-500">{t('Playtime')}</span>
					{t('{hours} hours', { hours: Math.round(player.playtimeForever / 60) })}
				</span>
			{/if}
			{#if player.playtime2weeks}
				<span>
					<span class="text-secondary-500">{t('Past 2 weeks')}</span>
					{t('{hours} hours', { hours: Math.round(player.playtime2weeks / 60) })}
				</span>
			{/if}
		</div>
	</div>
{/await}
