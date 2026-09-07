<script lang="ts">
	import { goto } from '$app/navigation';
	import { Alert } from '@company-of-heroes/ui/alert';
	import { Button } from '@company-of-heroes/ui/button';
	import * as Form from '@company-of-heroes/ui/form';
	import { Input } from '@company-of-heroes/ui/input';
	import { PlayerSearchCard } from '@company-of-heroes/ui/player';
	import { PlayerCompare } from '@company-of-heroes/ui/player-compare';
	import type { PlayerSearchResult } from '@company-of-heroes/ui/player/types';
	import { SITE_URL } from '$lib/site/urls';
	import { searchPlayers } from '$lib/remote/players.remote';
	import { href, useI18n } from '$lib/i18n';
	import {
		flagImageUrl,
		getFactionFlagByLeaderboardId,
		getRankImageByLeaderboardId,
		profileHref,
		resolveAvatarUrl,
		resolveFactionFlag,
		resolveFallbackSrc,
		resolveMapSrc
	} from '$lib/utils/resolvers';
	import ArrowsLeftRightIcon from 'phosphor-svelte/lib/ArrowsLeftRightIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { watch } from 'runed';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	type Side = 'a' | 'b';

	let activeSide = $state<Side>('a');
	let query = $state('');
	let searching = $state(false);
	let searchError = $state<string | null>(null);
	let results = $state.raw<PlayerSearchResult[]>([]);

	const aId = $derived(data.a);
	const bId = $derived(data.b);
	const compare = $derived(data.compare);
	const leftLabel = $derived(
		compare?.left.alias ?? (aId != null ? String(aId) : t('Player A'))
	);
	const rightLabel = $derived(
		compare?.right.alias ?? (bId != null ? String(bId) : t('Player B'))
	);

	watch(
		() => `${aId ?? ''}:${bId ?? ''}`,
		() => {
			results = [];
			query = '';
			searchError = null;
		}
	);

	function compareHref(a: number | null, b: number | null) {
		const params = new URLSearchParams();
		if (a != null) {
			params.set('a', String(a));
		}
		if (b != null) {
			params.set('b', String(b));
		}

		const qs = params.toString();
		return href(qs ? `/compare?${qs}` : '/compare');
	}

	async function runSearch(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = query.trim();
		if (!trimmed) {
			return;
		}

		searching = true;
		searchError = null;
		results = [];

		try {
			results = await searchPlayers({ q: trimmed });
			if (results.length === 0) {
				searchError = t('Player not found');
			}
		} catch {
			searchError = t('Failed to search for player');
		} finally {
			searching = false;
		}
	}

	function swapPlayers() {
		void goto(compareHref(bId, aId));
	}

	function playerHref(profileId: number, _steamId: string) {
		return profileHref(profileId);
	}

	function matchHref(lobbyId: string, _sessionId: number) {
		if (lobbyId) {
			return href(`/replays/${lobbyId}`);
		}

		return null;
	}
</script>

<svelte:head>
	<title>{t('Compare players')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t('Select two players to compare.')}
	/>
	<meta property="og:url" content="{SITE_URL}{href('/compare')}" />
	<meta property="og:title" content={t('Compare players')} />
</svelte:head>

<div class="border-secondary-800 border-b px-4 py-4">
	<h1 class="font-heading text-2xl font-bold text-white">{t('Compare players')}</h1>
	<p class="text-secondary-400 mt-1 text-sm">{t('Select two players to compare.')}</p>
</div>

<div class="border-secondary-800 grid grid-cols-1 gap-3 border-b p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
	<div class="min-w-0">
		<p class="text-secondary-500 mb-1 text-xs font-semibold tracking-wide uppercase">
			{t('Player A')}
		</p>
		<button
			type="button"
			class="border-secondary-700 hover:border-primary/50 w-full cursor-pointer rounded border px-3 py-2 text-left transition-colors"
			class:border-primary={activeSide === 'a'}
			onclick={() => (activeSide = 'a')}
		>
			<span class="font-heading truncate text-lg font-bold text-white">{leftLabel}</span>
		</button>
	</div>
	<div class="flex justify-center">
		<Button
			type="button"
			variant="secondary"
			size="sm"
			disabled={aId == null && bId == null}
			onclick={swapPlayers}
			aria-label={t('Swap players')}
		>
			<ArrowsLeftRightIcon size={16} />
			{t('Swap players')}
		</Button>
	</div>
	<div class="min-w-0">
		<p class="text-secondary-500 mb-1 text-xs font-semibold tracking-wide uppercase">
			{t('Player B')}
		</p>
		<button
			type="button"
			class="border-secondary-700 hover:border-primary/50 w-full cursor-pointer rounded border px-3 py-2 text-left transition-colors"
			class:border-primary={activeSide === 'b'}
			onclick={() => (activeSide = 'b')}
		>
			<span class="font-heading truncate text-lg font-bold text-white">{rightLabel}</span>
		</button>
	</div>
</div>

<Form.Root onsubmit={runSearch}>
	<Form.Group
		inputId="compare-player-search"
		label={activeSide === 'a' ? t('Player A') : t('Player B')}
		description={t('Search for a player by Steam ID, profile ID, or in-game name.')}
	>
		<Input
			id="compare-player-search"
			type="text"
			autocomplete="off"
			placeholder={t('Steam ID, profile ID, or player name')}
			bind:value={query}
			disabled={searching}
			aria-label={t('Find a player')}
		/>
		<Button
			type="submit"
			variant="secondary"
			class="w-fit shrink-0"
			loading={searching}
			disabled={query.trim().length === 0 || searching}
		>
			<MagnifyingGlassIcon size={16} />
			{t('Search')}
		</Button>
	</Form.Group>
</Form.Root>

{#if searchError}
	<div class="border-secondary-800 border-b px-4 py-3">
		<Alert variant="destructive">{searchError}</Alert>
	</div>
{/if}

{#if results.length > 0}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-3 text-sm">
		{results.length === 1
			? t('{count} player found', { count: results.length })
			: t('{count} players found', { count: results.length })}
	</p>
	<div>
		{#each results as player (player.profileId)}
			<PlayerSearchCard
				{player}
				href={compareHref(
					activeSide === 'a' ? player.profileId : aId,
					activeSide === 'b' ? player.profileId : bId
				)}
				flagSrc={flagImageUrl(player.country)}
				{resolveAvatarUrl}
				steamIdLabel={t('Steam ID:')}
				profileIdLabel={t('Profile ID:')}
			/>
		{/each}
	</div>
{/if}

{#if compare}
	<PlayerCompare
		data={compare}
		{flagImageUrl}
		{resolveAvatarUrl}
		{playerHref}
		{matchHref}
		{resolveMapSrc}
		{resolveFallbackSrc}
		{resolveFactionFlag}
		{getRankImageByLeaderboardId}
		{getFactionFlagByLeaderboardId}
		headToHeadLabel={t('Head to head')}
		trackedLabel={t('Tracked community matches')}
		togetherLabel={t('Played together as teammates')}
		ladderLabel={t('Ladder stats')}
		performanceLabel={t('Community performance')}
		byModeLabel={t('By mode')}
		byMapLabel={t('By map')}
		recentLabel={t('Recent matchups')}
		gamesLabel={t('Games')}
		mapLabel={t('Map')}
		modeLabel={t('Mode')}
		emptyH2hLabel={t('No tracked games against each other yet.')}
		emptyLadderLabel={t('No leaderboard stats yet.')}
		emptyPerformanceLabel={t('No tracked community matches for this player.')}
		factionsLabel={t('Factions')}
		leftWinLabel={t('{alias} win', { alias: compare.left.alias })}
		rightWinLabel={t('{alias} win', { alias: compare.right.alias })}
		viewMatchLabel={t('View match')}
	/>
{:else if aId != null && bId != null && aId === bId}
	<p class="text-secondary-400 px-4 py-6 text-sm">{t('Select two players to compare.')}</p>
{:else}
	<p class="text-secondary-400 px-4 py-6 text-sm">{t('Select two players to compare.')}</p>
{/if}
