<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		formatStreak,
		interactive,
		statLosses,
		statStreakClass,
		statWins
	} from '@company-of-heroes/ui/variants';
	import { getEloColor, getEloTextShadow } from '@company-of-heroes/ui/format/player-format';
	import { hasLiveLobbyStats } from './stats';
	import PlayerLikeCount from '../player/player-like-count.svelte';
	import {
		defaultLiveLobbyPlayerLabel,
		playerRowKey,
		teamPlayers,
		type LiveLobbyPlayer
	} from './types';

	type Props = {
		players: LiveLobbyPlayer[];
		meSteamIds?: string[];
		resolveFactionFlag: (race: number) => string;
		playerHref: (player: LiveLobbyPlayer) => string | null;
		playerLabel?: (player: LiveLobbyPlayer) => string;
		showStats?: boolean;
		alliesLabel?: string;
		axisLabel?: string;
		eloLabel?: string;
		levelLabel?: string;
		posLabel?: string;
		winsLabel?: string;
		lossesLabel?: string;
		streakLabel?: string;
	};

	let {
		players,
		meSteamIds = [],
		resolveFactionFlag,
		playerHref,
		playerLabel = defaultLiveLobbyPlayerLabel,
		showStats,
		alliesLabel = 'Allies',
		axisLabel = 'Axis',
		eloLabel = 'ELO',
		levelLabel = 'Level',
		posLabel = 'Pos',
		winsLabel = 'W',
		lossesLabel = 'L',
		streakLabel = 'Streak'
	}: Props = $props();

	const allies = $derived(teamPlayers(players, 'allies'));
	const axis = $derived(teamPlayers(players, 'axis'));
	const withStats = $derived(showStats ?? hasLiveLobbyStats(players));
	const playerGrid = $derived(
		withStats
			? 'grid grid-cols-[minmax(0,1fr)_5.5rem_4rem_3rem_3.25rem_3.25rem_3.25rem] items-center gap-2'
			: 'grid grid-cols-[minmax(0,1fr)] items-center gap-2'
	);
</script>

{#snippet missing()}
	<span class="text-secondary-400">—</span>
{/snippet}

{#snippet playerRow(player: LiveLobbyPlayer, rowIndex: number)}
	{@const cpu = player.playerId === -1}
	{@const href = cpu ? null : playerHref(player)}
	{@const label = playerLabel(player)}
	{@const stats = cpu ? null : player.stats}
	{@const isMe = Boolean(!cpu && player.steamId && meSteamIds.includes(player.steamId))}
	<div class={cn(playerGrid, 'border-secondary-800 h-11 border-b px-4 last:border-b-0')}>
		<div class="flex min-w-0 items-center gap-2.5">
			{#if href}
				<a {href} title={label} class={cn(interactive, 'shrink-0 rounded-full')}>
					<img
						src={resolveFactionFlag(player.race)}
						alt=""
						class={cn(
							'!size-5 shrink-0 rounded-full object-cover ring-secondary-800 ring-4',
							isMe && 'ring-primary'
						)}
					/>
				</a>
			{:else}
				<img
					src={resolveFactionFlag(player.race)}
					alt=""
					title={label}
					class={cn(
						'!size-5 shrink-0 rounded-full object-cover ring-secondary-800 ring-4 opacity-70',
						isMe && 'ring-primary'
					)}
				/>
			{/if}
			{#if !cpu}
				<PlayerLikeCount likeCount={player.likeCount} class="shrink-0" />
			{/if}
			{#if href}
				<a {href} class={cn(interactive, 'min-w-0 truncate text-sm font-medium text-white')}>
					{label}
				</a>
			{:else}
				<span class="text-secondary-300 min-w-0 truncate text-sm">{label}</span>
			{/if}
		</div>
		{#if withStats}
			<div class="flex items-center justify-center text-sm font-semibold tabular-nums">
				{#if stats?.elo != null}
					<span style:color={getEloColor(stats.elo)} style:text-shadow={getEloTextShadow(stats.elo)}>
						{stats.elo}
					</span>
				{:else}
					{@render missing()}
				{/if}
			</div>
			<div class="text-center text-sm font-medium tabular-nums">
				{#if stats && stats.rankLevel > 0}
					{stats.rankLevel}
				{:else}
					{@render missing()}
				{/if}
			</div>
			<div class="text-center text-sm font-medium tabular-nums">
				{#if stats && stats.rank > 0}
					{stats.rank}
				{:else}
					{@render missing()}
				{/if}
			</div>
			<div class={cn('text-center text-sm font-medium', stats ? statWins : undefined)}>
				{#if stats}
					{stats.wins}
				{:else}
					{@render missing()}
				{/if}
			</div>
			<div class={cn('text-center text-sm font-medium', stats ? statLosses : undefined)}>
				{#if stats}
					{stats.losses}
				{:else}
					{@render missing()}
				{/if}
			</div>
			<div class={cn('text-center text-sm font-medium', stats && statStreakClass(stats.streak))}>
				{#if stats}
					{formatStreak(stats.streak)}
				{:else}
					{@render missing()}
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet teamColumn(label: string, team: LiveLobbyPlayer[])}
	<div class="min-w-0">
		<div
			class={cn(
				playerGrid,
				'bg-secondary-950/90 text-secondary-300 border-secondary-800 border-b px-4 py-2.5 text-xs font-semibold tracking-wide uppercase'
			)}
		>
			<span>{label}</span>
			{#if withStats}
				<span class="text-center">{eloLabel}</span>
				<span class="text-center">{levelLabel}</span>
				<span class="text-center">{posLabel}</span>
				<span class="text-center">{winsLabel}</span>
				<span class="text-center">{lossesLabel}</span>
				<span class="text-center">{streakLabel}</span>
			{/if}
		</div>
		{#each team as player, rowIndex (playerRowKey(player, rowIndex))}
			{@render playerRow(player, rowIndex)}
		{/each}
	</div>
{/snippet}

<div class="divide-secondary-800 border-secondary-800 grid grid-cols-1 border-b md:grid-cols-2 md:divide-x">
	{@render teamColumn(alliesLabel, allies)}
	{@render teamColumn(axisLabel, axis)}
</div>
