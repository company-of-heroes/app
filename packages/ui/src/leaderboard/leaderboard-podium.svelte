<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		formatStreak,
		interactive,
		statLosses,
		statStreakClass,
		statWins
	} from '@company-of-heroes/ui/variants';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import CrownIcon from 'phosphor-svelte/lib/CrownIcon';
	import PlayerLabels from '../player/player-labels.svelte';
	import PlayerLikeCount from '../player/player-like-count.svelte';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import { playerPreviewId } from '../player/player-preview-cache';
	import type { LeaderboardStatRow, PlayerEloMap } from '../format/types';
	import {
		getEloColor,
		getEloTextShadow,
		getStoredEloForLeaderboard,
		isEliteElo
	} from '../format/player-format';

	type Props = {
		stats: LeaderboardStatRow[];
		eloBySteamId: Record<string, PlayerEloMap>;
		getSteamIdFromName: (name: string) => string;
		getCountryDisplayName: (country: string | null | undefined) => string | null;
		getRankImageByLeaderboardId: (leaderboardId: number, rankLevel: number) => string;
		flagImageUrl: (country: string | null | undefined) => string | null;
		playerHref: (profileId: number) => string;
		resolveAvatarUrl?: (url: string) => string;
		loading?: boolean;
		class?: string;
		naLabel?: string;
		formatLevel?: (level: number) => string;
		formatWins?: (wins: number) => string;
		formatLosses?: (losses: number) => string;
		formatStreakLabel?: (streak: string) => string;
	};

	let {
		stats,
		eloBySteamId,
		getSteamIdFromName,
		getCountryDisplayName,
		getRankImageByLeaderboardId,
		flagImageUrl,
		playerHref,
		resolveAvatarUrl = (url) => url,
		loading = false,
		class: className,
		naLabel = 'N/A',
		formatLevel = (level) => `Lvl ${level}`,
		formatWins = (wins) => `${wins}W`,
		formatLosses = (losses) => `${losses}L`,
		formatStreakLabel = (streak) => `${streak} streak`
	}: Props = $props();

	const podiumOrder = $derived.by(() => {
		const first = stats[0];
		const second = stats[1];
		const third = stats[2];
		return [second, first, third].filter((stat): stat is LeaderboardStatRow => Boolean(stat));
	});

	function eloForStat(stat: LeaderboardStatRow): number | null {
		return getStoredEloForLeaderboard(
			eloBySteamId[getSteamIdFromName(stat.profile.name)],
			stat.leaderboard_id
		);
	}

	function podiumCellClass(rank: number) {
		return cn(
			interactive,
			'flex min-w-0 flex-col items-center gap-2 px-4 py-5 text-center transition-colors',
			'hover:bg-secondary-950/50',
			rank === 1 && 'bg-primary/5 hover:bg-primary/10 sm:py-6'
		);
	}
</script>

<div
	class={cn(
		'border-secondary-800 sm:divide-secondary-800 grid grid-cols-1 border-b sm:grid-cols-3 sm:divide-x',
		className
	)}
>
	{#if loading}
		{#each [2, 1, 3] as rank (rank)}
			<div class={podiumCellClass(rank)}>
				<Skeleton class="h-5 w-8" />
				<Skeleton class={cn('rounded-xl', rank === 1 ? 'size-16' : 'size-14')} />
				<Skeleton class="h-5 w-28" />
				<Skeleton class="h-4 w-36" />
			</div>
		{/each}
	{:else}
		{#each podiumOrder as stat (stat.profile.profile_id)}
			{@const elo = eloForStat(stat)}
			{@const countryName = getCountryDisplayName(stat.profile.country)}
			{@const flagUrl = flagImageUrl(stat.profile.country)}
			<PlayerProfileLink
				href={playerHref(stat.profile.profile_id)}
				playerId={playerPreviewId({
					steamId: getSteamIdFromName(stat.profile.name),
					profileId: stat.profile.profile_id
				}) ?? String(stat.profile.profile_id)}
				class={podiumCellClass(stat.rank)}
			>
				<div class="flex w-full items-center justify-between gap-2">
					<span
						class={cn(
							'font-heading font-bold tabular-nums',
							stat.rank === 1 ? 'text-primary text-xl' : 'text-secondary-300'
						)}
					>
						#{stat.rank}
					</span>
					{#if stat.rank === 1}
						<CrownIcon class="text-primary size-5" weight="duotone" />
					{/if}
				</div>
				{#if stat.profile.avatarUrl}
					<img
						src={resolveAvatarUrl(stat.profile.avatarUrl)}
						alt=""
						class={cn(
							'border-secondary-700 shrink-0 rounded-xl border-2 object-cover',
							stat.rank === 1 ? 'border-primary/40 size-16' : 'size-14'
						)}
					/>
				{:else}
					<div
						class={cn(
							'bg-secondary-800 shrink-0 rounded-xl',
							stat.rank === 1 ? 'size-16' : 'size-14'
						)}
					></div>
				{/if}
				<div class="flex items-center gap-2">
					<img
						src={getRankImageByLeaderboardId(stat.leaderboard_id, stat.ranklevel)}
						alt=""
						class={cn('w-auto', stat.rank === 1 ? 'h-8' : 'h-7')}
					/>
					<span class="text-secondary-400 text-sm tabular-nums"
						>{formatLevel(stat.ranklevel)}</span
					>
				</div>
				<div
					class={cn(
						'font-heading flex w-full min-w-0 items-center justify-center gap-2 font-bold',
						stat.rank === 1 ? 'text-primary text-xl' : 'text-white'
					)}
				>
					{#if flagUrl}
						<img
							class={cn('w-auto shrink-0 rounded-xs', stat.rank === 1 ? 'h-5' : 'h-4')}
							src={flagUrl}
							alt={countryName ?? stat.profile.country ?? ''}
							title={countryName ?? undefined}
						/>
					{/if}
					<PlayerLikeCount likeCount={stat.profile.likeCount} class="shrink-0" />
					<span class="truncate">{stat.profile.alias}</span>
					<PlayerLabels labels={stat.profile.labels} class="shrink-0" />
				</div>
				{#if elo == null}
					<span class="text-secondary-500 text-xs">{naLabel}</span>
				{:else}
					<span
						class={cn(
							'tabular-nums',
							stat.rank === 1 ? 'text-lg' : 'text-base',
							isEliteElo(elo) ? 'font-bold tracking-wide' : 'font-medium'
						)}
						style:color={getEloColor(elo)}
						style:text-shadow={getEloTextShadow(elo)}
					>
						{elo}
					</span>
				{/if}
				<div
					class="text-secondary-400 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm"
				>
					<span class={statWins}>{formatWins(stat.wins)}</span>
					<span class="text-secondary-600">·</span>
					<span class={statLosses}>{formatLosses(stat.losses)}</span>
					<span class="text-secondary-600">·</span>
					<span class={statStreakClass(stat.streak)}
						>{formatStreakLabel(formatStreak(stat.streak))}</span
					>
				</div>
			</PlayerProfileLink>
		{/each}
	{/if}
</div>
