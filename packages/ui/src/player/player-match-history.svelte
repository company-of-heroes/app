<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, statLosses, statWins, tableHeadRow } from '@company-of-heroes/ui/variants';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import ChecksIcon from 'phosphor-svelte/lib/ChecksIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import MinusIcon from 'phosphor-svelte/lib/MinusIcon';
	import { Button } from '../ui/button';
	import MapImage from '../ui/map-image.svelte';
	import {
		formatDuration,
		formatMatchStamp,
		getEloColor,
		getEloTextShadow,
		isEliteElo,
		normalizeMapName
	} from '../format/player-format';
	import { formatStreak, streakClass } from '../format/ranks';
	import type { MatchHistoryPlayer, PlayerPageData, TransformedMatch } from './types';
	import { isRankedMatchType } from './match-history-ranks';
	import PlayerLabels from './player-labels.svelte';
	import PlayerLikeCount from './player-like-count.svelte';
	import PlayerProfileLink from './player-profile-link.svelte';
	import { playerPreviewId } from './player-preview-cache';
	import { useHost } from '../host/host.context';

	type Props = {
		player: PlayerPageData;
		showAvatars?: boolean;
		showSessionId?: boolean;
		matchActions?: Snippet<[{ match: TransformedMatch }]>;
	};

	let { player, showAvatars = false, showSessionId = true, matchActions }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const stamp = (unix: number) => formatMatchStamp(unix, host.locale());
	const detailsHref = (match: TransformedMatch) =>
		match.lobbyId ? host.routes.match(match.lobbyId) : null;

	const matches = $derived(
		[...player.matchHistory].sort((a, b) => b.completiontime - a.completiontime)
	);

	function ratingDelta(matchPlayer: MatchHistoryPlayer): number {
		return (matchPlayer.newrating ?? 0) - (matchPlayer.oldrating ?? 0);
	}

	function displayElo(matchPlayer: MatchHistoryPlayer): number | null {
		if (matchPlayer.newrating >= 1) {
			return matchPlayer.newrating;
		}

		if (matchPlayer.oldrating >= 1) {
			return matchPlayer.oldrating;
		}

		return null;
	}
</script>

{#snippet ratingDeltaBadge(delta: number)}
	<span class="inline-flex items-center gap-0.5 text-sm tabular-nums">
		{#if delta < 0}
			<CaretDownIcon class="text-destructive size-3.5 shrink-0" weight="duotone" />
			<span class="text-red-200">{Math.abs(delta)}</span>
		{:else if delta > 0}
			<CaretUpIcon class="text-success size-3.5 shrink-0" weight="duotone" />
			<span class="text-green-200">{delta}</span>
		{:else}
			<MinusIcon class="text-secondary-500 size-3.5 shrink-0" />
		{/if}
	</span>
{/snippet}

{#snippet eloValue(elo: number | null)}
	{#if elo == null}
		<span class="text-secondary-500 text-xs font-normal">N/A</span>
	{:else}
		<span
			class={cn('tabular-nums', isEliteElo(elo) ? 'font-bold tracking-wide' : 'font-medium')}
			style:color={getEloColor(elo)}
			style:text-shadow={getEloTextShadow(elo)}
		>
			{elo}
		</span>
	{/if}
{/snippet}

{#snippet rankBadge(matchPlayer: MatchHistoryPlayer, matchTypeId: number)}
	{#if !isRankedMatchType(matchTypeId)}
		<span class="text-secondary-400 tabular-nums">-</span>
	{:else}
		<span class="flex items-center justify-center gap-2">
			<img
				src={host.resolve.rankImageByRace(matchPlayer.race_id, matchPlayer.ranklevel ?? 0)}
				alt=""
				class="size-6 shrink-0 object-contain"
			/>
			<span class="font-semibold tabular-nums">
				{(matchPlayer.ranklevel ?? 0) > 0 ? matchPlayer.ranklevel : '-'}
			</span>
		</span>
	{/if}
{/snippet}

{#snippet playerIdentity(matchPlayer: MatchHistoryPlayer, isSelf: boolean, flagUrl: string | null)}
	<div class="flex min-w-0 items-center gap-2">
		{#if showAvatars}
			<span class="border-secondary-800 size-8 shrink-0 overflow-hidden rounded-lg border">
				{#if matchPlayer.avatarUrl}
					<img
						src={host.resolve.avatarUrl(matchPlayer.avatarUrl)}
						alt=""
						class="size-full object-cover"
					/>
				{:else}
					<span class="flex size-full items-center justify-center bg-gray-600">
						<span class="text-xl text-white">?</span>
					</span>
				{/if}
			</span>
		{/if}
		{#if flagUrl}
			<span
				class="ring-secondary-800 h-5 w-5 shrink-0 rounded-full bg-size-[48px] bg-center bg-no-repeat ring-4"
				style="background-image: url('{flagUrl}')"
			></span>
		{/if}
		<PlayerLikeCount likeCount={matchPlayer.likeCount} class="shrink-0" />
		{#if matchPlayer.steamId}
			<PlayerProfileLink
				href={host.routes.player(matchPlayer.steamId)}
				playerId={playerPreviewId({
					steamId: matchPlayer.steamId,
					profileId: matchPlayer.profile_id
				}) ?? matchPlayer.steamId}
				class={cn(
					interactive,
					'hover:text-primary min-w-0 flex-1 truncate transition-colors',
					isSelf && 'text-primary font-semibold'
				)}
			>
				{matchPlayer.alias}
			</PlayerProfileLink>
		{:else}
			<span class={cn('min-w-0 flex-1 truncate', isSelf && 'text-primary font-semibold')}>
				{matchPlayer.alias}
			</span>
		{/if}
		<PlayerLabels labels={matchPlayer.labels} class="shrink-0" />
	</div>
{/snippet}

{#if matches.length === 0}
	<p class="text-secondary-400 px-4 py-3 text-sm">{t('No recent Relic matches found.')}</p>
{:else}
	<div>
		{#each matches as match (match.id)}
			{@const players = [...match.players].sort((a, b) => a.teamid - b.teamid)}
			{@const href = detailsHref(match)}
			<section class="border-secondary-800 border-b">
				<div
					class="border-secondary-800 flex min-w-0 flex-wrap items-center gap-4 border-b px-4 py-2"
				>
					<MapImage
						small
						map={match.mapname}
						alt={normalizeMapName(match.mapname)}
						resolveMapSrc={host.resolve.mapSrc}
					/>
					<div class="min-w-0 grow">
						<h3 class="font-heading truncate text-lg font-bold">
							{normalizeMapName(match.mapname)}
						</h3>
						<p class="text-secondary-400 text-sm">
							{stamp(match.startgametime)}
							{#if showSessionId}
								<span class="text-secondary-500 text-xs tabular-nums">
									· {t('ID: {id}', { id: match.id })}
								</span>
							{/if}
						</p>
					</div>
					<div class="flex min-w-0 shrink-0 flex-wrap items-center gap-4">
						{@render matchActions?.({ match })}
						{#if href}
							<Button {href} size="sm" variant="secondary">
								<ChecksIcon class="size-4 text-green-400" />
								{t('View match')}
							</Button>
						{/if}
						<span class="text-secondary-300 flex items-center gap-2 text-sm font-medium">
							<ClockIcon class="size-4" />
							{formatDuration(match.startgametime, match.completiontime)}
						</span>
					</div>
				</div>
				<div class="hidden overflow-x-auto md:block">
					<table class="w-full table-fixed text-sm">
						<colgroup>
							<col class="w-14" />
							<col class="w-14" />
							<col class="w-[4.5rem]" />
							<col class="w-12" />
							<col />
							<col class="w-14" />
							<col class="w-14" />
							<col class="w-14" />
						</colgroup>
						<thead>
							<tr class={tableHeadRow}>
								<th class="px-2 py-2 text-center">{t('Change')}</th>
								<th class="px-2 py-2 text-center">{t('ELO')}</th>
								<th class="px-2 py-2 text-center">{t('Rank')}</th>
								<th class="px-2 py-2 text-center">{t('Team')}</th>
								<th class="px-3 py-2 text-left">{t('Player')}</th>
								<th class="px-2 py-2 text-center">{t('Wins')}</th>
								<th class="px-2 py-2 text-center">{t('Losses')}</th>
								<th class="px-2 py-2 text-center">{t('Streak')}</th>
							</tr>
						</thead>
						<tbody>
							{#each players as matchPlayer (matchPlayer.profile_id)}
								{@const isSelf = matchPlayer.profile_id === player.profileId}
								{@const elo = displayElo(matchPlayer)}
								{@const delta = ratingDelta(matchPlayer)}
								{@const flagUrl = host.resolve.flagImageUrl(matchPlayer.country ?? null)}
								<tr
									class={cn(
										'border-secondary-800 h-9 border-b',
										matchPlayer.outcome === 1 ? 'bg-success/5' : 'bg-destructive/5'
									)}
								>
									<td class="px-2 py-1.5 text-center">
										<div class="flex w-full justify-center">
											{@render ratingDeltaBadge(delta)}
										</div>
									</td>
									<td class="px-2 py-1.5 text-center">
										<div class="flex w-full justify-center">
											{@render eloValue(elo)}
										</div>
									</td>
									<td class="px-2 py-1.5 text-center">
										<div class="flex w-full justify-center">
											{@render rankBadge(matchPlayer, match.matchtype_id)}
										</div>
									</td>
									<td class="px-2 py-1.5 text-center">
										<div class="flex w-full justify-center">
											<img
												src={host.resolve.factionFlagByRace(matchPlayer.race_id)}
												alt=""
												class="h-auto w-6 shrink-0 object-contain ring-1 ring-black/40"
											/>
										</div>
									</td>
									<td class="px-3 py-1.5 text-left">
										{@render playerIdentity(matchPlayer, isSelf, flagUrl)}
									</td>
									<td class="px-2 py-1.5 text-center">
										<div class="flex w-full justify-center">
											<span class="{statWins} text-center font-medium tabular-nums">
												{matchPlayer.wins}
											</span>
										</div>
									</td>
									<td class="px-2 py-1.5 text-center">
										<div class="flex w-full justify-center">
											<span class="{statLosses} text-center font-medium tabular-nums">
												{matchPlayer.losses}
											</span>
										</div>
									</td>
									<td class="px-2 py-1.5 text-center">
										<div class="flex w-full justify-center">
											<span
												class="text-center font-medium tabular-nums {streakClass(
													matchPlayer.streak
												)}"
											>
												{formatStreak(matchPlayer.streak)}
											</span>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="divide-secondary-800 divide-y md:hidden">
					{#each players as matchPlayer (matchPlayer.profile_id)}
						{@const isSelf = matchPlayer.profile_id === player.profileId}
						{@const elo = displayElo(matchPlayer)}
						{@const delta = ratingDelta(matchPlayer)}
						{@const flagUrl = host.resolve.flagImageUrl(matchPlayer.country ?? null)}
						<div
							class={cn(
								'space-y-2 px-4 py-3',
								matchPlayer.outcome === 1 ? 'bg-success/5' : 'bg-destructive/5'
							)}
						>
							{@render playerIdentity(matchPlayer, isSelf, flagUrl)}
							<div class="text-secondary-300 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
								{@render ratingDeltaBadge(delta)}
								{@render eloValue(elo)}
								{@render rankBadge(matchPlayer, match.matchtype_id)}
								<img
									src={host.resolve.factionFlagByRace(matchPlayer.race_id)}
									alt=""
									class="h-auto w-6 shrink-0 object-contain ring-1 ring-black/40"
								/>
								<span class="{statWins} font-medium tabular-nums">{matchPlayer.wins}</span>
								<span class="{statLosses} font-medium tabular-nums">{matchPlayer.losses}</span>
								<span class="font-medium tabular-nums {streakClass(matchPlayer.streak)}">
									{formatStreak(matchPlayer.streak)}
								</span>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/if}
