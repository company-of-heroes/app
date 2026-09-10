<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import {
		LeaderboardList,
		LeaderboardPodium,
		LeaderboardSkeleton
	} from '@company-of-heroes/ui/leaderboard';
	import {
		flagImageUrl,
		getCountryDisplayName,
		getRankImageByLeaderboardId,
		getSteamIdFromName,
		profileHref,
		proxiedImageUrl
	} from '$lib/utils/resolvers';
	import {
		boardIdForMode,
		getModeForBoard,
		LEADERBOARD_MODES,
		type LeaderboardPageData
	} from '$lib/leaderboards';
	import { getRaceLabel } from '$lib/utils/player/format';
	import { getFactionFlagByRace } from '$lib/utils/media/ranks';
	import { href, unlocalizedPath, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import { cn } from '$lib/utils/cn';
	import { controlBase, tabTrigger } from '$lib/utils/variants';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	let searchInput = $state('');
	let debouncedSearch = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const boardId = $derived(data.boardId);
	const activeMode = $derived(getModeForBoard(boardId));
	const switching = $derived(
		Boolean(unlocalizedPath(navigating.to?.url.pathname ?? '').startsWith('/leaderboards'))
	);
	const activeModeLabel = $derived.by(() => {
		const faction = activeMode.factions.find((entry) => entry.value === boardId);
		return `${t(activeMode.label)} · ${t(getRaceLabel(faction?.race ?? 0))}`;
	});

	function onSearchInput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			debouncedSearch = searchInput;
		}, 250);
	}

	function selectBoard(id: number) {
		if (id === boardId) return;
		searchInput = '';
		debouncedSearch = '';
		void goto(href(`/leaderboards?board=${id}`), {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}

	function selectMode(modeValue: number) {
		const mode = LEADERBOARD_MODES.find((entry) => entry.value === modeValue);
		if (!mode) return;
		selectBoard(boardIdForMode(mode, boardId));
	}

	function filterStats(board: LeaderboardPageData) {
		const query = debouncedSearch.trim().toLowerCase();
		if (!query) return board.stats;
		return board.stats.filter((stat) => {
			const alias = stat.profile.alias.toLowerCase();
			return alias.startsWith(query) || alias.includes(query);
		});
	}
</script>

<svelte:head>
	<title>{t('Leaderboards')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t('Relic Company of Heroes leaderboards by mode and faction, with companion ELO.')}
	/>
	<meta property="og:url" content="{SITE_URL}{href('/leaderboards')}" />
	<meta property="og:title" content={t('CoH Leaderboards')} />
</svelte:head>

<div class="border-secondary-800 border-b px-4 py-3">
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex flex-wrap items-center gap-1.5">
				{#each LEADERBOARD_MODES as mode (mode.value)}
					<button
						type="button"
						class={tabTrigger}
						data-state={activeMode.value === mode.value ? 'active' : undefined}
						onclick={() => selectMode(mode.value)}
					>
						{t(mode.label)}
					</button>
				{/each}
			</div>
			<div class="flex flex-wrap items-center gap-1.5">
				{#each activeMode.factions as faction (faction.value)}
					<button
						type="button"
						class={cn(tabTrigger, 'px-2')}
						data-state={boardId === faction.value ? 'active' : undefined}
						aria-label={t(faction.label)}
						onclick={() => selectBoard(faction.value)}
					>
						<img
							src={getFactionFlagByRace(faction.race)}
							alt=""
							class="h-5 w-auto border border-black"
						/>
					</button>
				{/each}
			</div>
			<p class="text-secondary-400 text-sm">{activeModeLabel}</p>
		</div>
		<label class={cn(controlBase, 'flex w-full items-center sm:w-58')}>
			<MagnifyingGlassIcon class="text-secondary-500 ml-3 size-4 shrink-0" />
			<input
				type="search"
				placeholder={t('Search player...')}
				bind:value={searchInput}
				oninput={onSearchInput}
				class="placeholder:text-secondary-500 min-w-0 flex-1 bg-transparent px-3 text-sm text-white focus:outline-none"
			/>
		</label>
	</div>
</div>

{#if switching}
	<LeaderboardSkeleton />
{:else}
	{#await data.board}
		<LeaderboardSkeleton />
	{:then board}
		{@const filtered = filterStats(board)}
		{@const searching = debouncedSearch.trim().length > 0}
		{@const podiumStats = searching ? [] : filtered.slice(0, 3)}
		{@const listStats = searching ? filtered : filtered.slice(3)}
		{#if podiumStats.length > 0}
			<LeaderboardPodium
				stats={podiumStats}
				eloBySteamId={board.eloBySteamId}
				{getSteamIdFromName}
				{getCountryDisplayName}
				{getRankImageByLeaderboardId}
				{flagImageUrl}
				playerHref={profileHref}
				resolveAvatarUrl={proxiedImageUrl}
				naLabel={t('N/A')}
				formatLevel={(level) => t('Lvl {level}', { level })}
				formatWins={(wins) => t('{count}W', { count: wins })}
				formatLosses={(losses) => t('{count}L', { count: losses })}
				formatStreakLabel={(streak) => t('{streak} streak', { streak })}
			/>
		{/if}
		<LeaderboardList
			stats={listStats}
			eloBySteamId={board.eloBySteamId}
			{getSteamIdFromName}
			{getCountryDisplayName}
			{getRankImageByLeaderboardId}
			{flagImageUrl}
			playerHref={profileHref}
			emptyMessage={t('No players found.')}
			rankColumnLabel={t('Rank')}
			aliasColumnLabel={t('Alias')}
			eloColumnLabel={t('ELO')}
			winsColumnLabel={t('Wins')}
			lossesColumnLabel={t('Losses')}
			streakColumnLabel={t('Streak')}
			ratioColumnLabel={t('Ratio')}
			naLabel={t('N/A')}
		/>
	{/await}
{/if}
