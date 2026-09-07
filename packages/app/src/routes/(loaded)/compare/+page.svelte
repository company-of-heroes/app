<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resource, watch } from 'runed';
	import { api, unwrapApi } from '$core/api';
	import type { PlayerCompareResult } from '@company-of-heroes/api';
	import type { PlayerSearchResult } from '@company-of-heroes/ui/player/types';
	import { PlayerCompare } from '@company-of-heroes/ui/player-compare';
	import { PlayerSearchCard } from '@company-of-heroes/ui/player';
	import { Alert } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { useI18n } from '$lib/i18n';
	import { getRankImageByLeaderboardId } from '$lib/utils';
	import { getDefaultMapImage, getFactionFlagFromLeaderboardId, getFactionFlagFromRace, getMapImageFromName } from '$lib/utils/game';
	import ArrowsLeftRightIcon from 'phosphor-svelte/lib/ArrowsLeftRightIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';

	const { t } = useI18n();

	type Side = 'a' | 'b';

	let activeSide = $state<Side>('a');
	let query = $state('');
	let searching = $state(false);
	let searchError = $state<string | null>(null);
	let results = $state.raw<PlayerSearchResult[]>([]);

	function parseProfileId(value: string | null): number | null {
		if (!value) {
			return null;
		}

		const id = Number(value);
		if (!Number.isInteger(id) || id <= 0) {
			return null;
		}

		return id;
	}

	const aId = $derived.by(() => parseProfileId(page.url.searchParams.get('a')));
	const bId = $derived.by(() => parseProfileId(page.url.searchParams.get('b')));

	watch(
		() => `${aId ?? ''}:${bId ?? ''}`,
		() => {
			results = [];
			query = '';
			searchError = null;
		}
	);

	const compareResource = resource(
		() => (aId != null && bId != null && aId !== bId ? `${aId}:${bId}` : null),
		async (key) => {
			if (!key || aId == null || bId == null) {
				return null;
			}

			return unwrapApi(api.playerCompare.compare(aId, bId));
		}
	);

	const compare = $derived(compareResource.current as PlayerCompareResult | null | undefined);
	const leftLabel = $derived(
		compare?.left.alias ?? (aId != null ? String(aId) : t('Player A'))
	);
	const rightLabel = $derived(
		compare?.right.alias ?? (bId != null ? String(bId) : t('Player B'))
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
		return qs ? `/compare?${qs}` : '/compare';
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
			results = await unwrapApi(api.players.search(trimmed));
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

	function flagImageUrl(country: string | null | undefined): string | null {
		if (!country) {
			return null;
		}

		return `https://flagsapi.com/${country.toUpperCase()}/shiny/64.png`;
	}

	function resolveAvatarUrl(url: string): string {
		return url;
	}

	function playerHref(profileId: number, _steamId: string) {
		return `/players/${profileId}`;
	}

	function matchHref(lobbyId: string, _sessionId: number) {
		if (lobbyId) {
			return `/history/${lobbyId}`;
		}

		return null;
	}

	function resolveMapSrc(map: string | undefined): string | undefined {
		return getMapImageFromName(map);
	}

	function resolveFallbackSrc(): string | undefined {
		return getDefaultMapImage();
	}

	function resolveFactionFlag(raceId: number): string {
		return getFactionFlagFromRace(raceId);
	}
</script>

<SetCrumbs items={[{ label: t('Compare players') }]} />

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
			size="sm"
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

{#if compareResource.loading && aId != null && bId != null && aId !== bId}
	<p class="text-secondary-400 px-4 py-6 text-sm">{t('Searching...')}</p>
{:else if compareResource.error}
	<div class="border-secondary-800 border-b px-4 py-3">
		<Alert variant="destructive">{t('Failed to load comparison.')}</Alert>
	</div>
{:else if compare}
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
		getFactionFlagByLeaderboardId={getFactionFlagFromLeaderboardId}
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
{:else}
	<p class="text-secondary-400 px-4 py-6 text-sm">{t('Select two players to compare.')}</p>
{/if}
