<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		formatStreak,
		statLosses,
		statStreakClass,
		statWins,
		tableHeadRow
	} from '@company-of-heroes/ui/variants';
	import { getEloColor, getEloTextShadow } from '../format/player-format';
	import { Skeleton } from '../ui/skeleton';
	import PlayerLikeCount from './player-like-count.svelte';
	import type { PlayerFactionPreview, PlayerPreviewData } from './types';

	type Props = {
		player?: PlayerPreviewData | null;
		faction?: PlayerFactionPreview | null;
		loading?: boolean;
		error?: boolean;
		resolveAvatarUrl: (url: string) => string;
		flagImageUrl: (country: string | null | undefined) => string | null;
		levelLabel?: string;
		loadingLabel?: string;
		errorLabel?: string;
		eloLabel?: string;
		winsLabel?: string;
		lossesLabel?: string;
		streakLabel?: string;
		posLabel?: string;
		class?: string;
	};

	let {
		player = null,
		faction = null,
		loading = false,
		error = false,
		resolveAvatarUrl,
		flagImageUrl,
		levelLabel = 'Level',
		loadingLabel = 'Loading…',
		errorLabel = 'Could not load player',
		eloLabel = 'ELO',
		winsLabel = 'W',
		lossesLabel = 'L',
		streakLabel = 'Streak',
		posLabel = 'Rank',
		class: className
	}: Props = $props();

	const profileFlagSrc = $derived(player ? flagImageUrl(player.country) : null);
	const profileAvatarSrc = $derived(player?.avatarUrl ? resolveAvatarUrl(player.avatarUrl) : null);

	const factionFlagSrc = $derived(faction ? flagImageUrl(faction.country) : null);
	const factionAvatarSrc = $derived(
		faction?.avatarUrl ? resolveAvatarUrl(faction.avatarUrl) : null
	);
	/** Match squares prefer the rank/level badge over a steam avatar. */
	const factionMediaSrc = $derived(
		faction?.rankImageSrc || factionAvatarSrc || faction?.factionFlagSrc || null
	);
	const factionMediaContain = $derived(Boolean(faction?.rankImageSrc));
	const factionSubtitle = $derived(
		[faction?.modeLabel?.trim(), faction?.raceLabel?.trim()].filter(Boolean).join(' · ')
	);
	const stats = $derived(faction?.stats ?? null);
</script>

<div
	class={cn(
		'border-secondary-800 bg-gray-950 w-[360px] overflow-hidden rounded-none border shadow-lg',
		className
	)}
>
	{#if loading}
		<div class="grid grid-cols-[3rem_minmax(0,1fr)]" aria-busy="true" aria-label={loadingLabel}>
			<Skeleton class="border-secondary-800 aspect-square rounded-none border-r" />
			<div class="flex min-w-0 flex-col justify-center gap-2 px-3 py-2">
				<Skeleton class="h-4 w-28" />
				<Skeleton class="h-3 w-24" />
			</div>
		</div>
	{:else if faction}
		<div class="grid grid-cols-[3rem_minmax(0,1fr)] items-stretch">
			<div class="border-secondary-800 aspect-square overflow-clip border-r">
				{#if factionMediaSrc}
					<img
						src={factionMediaSrc}
						alt=""
						class={cn(
							'size-full',
							factionMediaContain ? 'object-contain p-1.5' : 'object-cover'
						)}
					/>
				{:else}
					<div class="bg-secondary-800 size-full"></div>
				{/if}
			</div>
			<div class="flex min-w-0 flex-col justify-center px-3 py-2">
				<div class="flex min-w-0 items-center gap-1.5">
					{#if factionFlagSrc}
						<img
							class="h-4 w-auto shrink-0 rounded-xs"
							src={factionFlagSrc}
							alt={faction.country ?? ''}
						/>
					{/if}
					<span class="font-heading truncate text-sm font-bold text-white">{faction.alias}</span>
				</div>
				{#if factionSubtitle}
					<p class="text-secondary-400 mt-0.5 truncate text-xs">{factionSubtitle}</p>
				{/if}
			</div>
		</div>
		{#if stats}
			<table class="w-full border-collapse text-xs">
				<thead>
					<tr class={cn(tableHeadRow, 'border-t border-secondary-800')}>
						<th class="px-2 py-1.5 text-center font-semibold whitespace-nowrap">{eloLabel}</th>
						<th class="px-2 py-1.5 text-center font-semibold whitespace-nowrap">{posLabel}</th>
						<th class="px-2 py-1.5 text-center font-semibold whitespace-nowrap">
							{winsLabel}/{lossesLabel}
						</th>
						<th class="px-2 py-1.5 text-center font-semibold whitespace-nowrap">{streakLabel}</th>
					</tr>
				</thead>
				<tbody>
					<tr class="h-9">
						<td class="px-2 py-1.5 text-center whitespace-nowrap">
							<span
								class="font-medium tabular-nums"
								style:color={stats.elo != null ? getEloColor(stats.elo) : undefined}
								style:text-shadow={getEloTextShadow(stats.elo)}
							>
								{stats.elo ?? '—'}
							</span>
						</td>
						<td class="px-2 py-1.5 text-center font-medium text-white tabular-nums whitespace-nowrap">
							{stats.rank > 0 ? `#${stats.rank}` : '—'}
						</td>
						<td class="px-2 py-1.5 text-center font-medium tabular-nums whitespace-nowrap">
							<span class={statWins}>{stats.wins}</span>
							<span class="text-secondary-600"> / </span>
							<span class={statLosses}>{stats.losses}</span>
						</td>
						<td
							class={cn(
								'px-2 py-1.5 text-center font-medium tabular-nums whitespace-nowrap',
								statStreakClass(stats.streak)
							)}
						>
							{formatStreak(stats.streak)}
						</td>
					</tr>
				</tbody>
			</table>
		{/if}
	{:else if error || !player}
		<p class="text-secondary-400 px-3 py-4 text-sm">{errorLabel}</p>
	{:else}
		<div class="grid grid-cols-[3rem_minmax(0,1fr)] items-stretch">
			<div class="border-secondary-800 aspect-square overflow-clip border-r">
				{#if profileAvatarSrc}
					<img src={profileAvatarSrc} alt="" class="size-full object-cover" />
				{:else}
					<div class="bg-secondary-800 size-full"></div>
				{/if}
			</div>
			<div class="flex min-w-0 flex-col justify-center px-3 py-2">
				<div class="flex min-w-0 items-center gap-1.5">
					{#if profileFlagSrc}
						<img
							class="h-4 w-auto shrink-0 rounded-xs"
							src={profileFlagSrc}
							alt={player.country ?? ''}
						/>
					{/if}
					<PlayerLikeCount likeCount={player.likeCount} class="shrink-0" />
					<span class="font-heading truncate text-sm font-bold text-white">{player.alias}</span>
				</div>
				<p class="text-secondary-400 mt-0.5 text-xs tabular-nums">
					{levelLabel}
					{player.level}
				</p>
			</div>
		</div>
	{/if}
</div>
