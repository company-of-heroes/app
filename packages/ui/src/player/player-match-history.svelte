<script lang="ts">
	import CountryFlag from './country-flag.svelte';
	import EloBadge from './elo-badge.svelte';
	import RankIcon from './rank-icon.svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		factionIcon,
		formatStreak,
		interactive,
		statLosses,
		statStreakClass,
		statWins,
		tableHeadRow
	} from '@company-of-heroes/ui/variants';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import FilmReelIcon from 'phosphor-svelte/lib/FilmReelIcon';
	import { Button } from '../ui/button';
	import MapImage from '../ui/map-image.svelte';
	import { formatDuration, formatMatchStamp, normalizeMapName } from '../format/player-format';
	import type { MatchHistoryPlayer, PlayerPageData, TransformedMatch } from './types';
	import PlayerLabels from './player-labels.svelte';
	import PlayerNameIcons from './player-name-icons.svelte';
	import PlayerLikeCount from './player-like-count.svelte';
	import PlayerProfileLink from './player-profile-link.svelte';
	import { useHost } from '../host/host.context';
	import { tooltip } from '../attachments/tooltip.svelte';
	import type { CommunityMatchDetail } from '../replay/types';
	import LeaderboardRecord from '../leaderboard/leaderboard-record.svelte';

	type Props = {
		player: PlayerPageData;
		showAvatars?: boolean;
		showSessionId?: boolean;
		matchActions?: Snippet<[{ match: TransformedMatch }]>;
	};

	let { player, showAvatars = false, showSessionId = true, matchActions }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	/** Same columns as the leaderboard table, plus the team: pos · change · level · ELO · team · player · games · wins · losses · win rate · streak. */
	const grid =
		'grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 md:grid-cols-[3.5rem_3.5rem_3.5rem_3.5rem_2.5rem_minmax(0,1fr)_4rem_3.5rem_3.5rem_4.5rem_4rem]';

	const stamp = (unix: number) => formatMatchStamp(unix, host.locale());
	const detailsHref = (match: TransformedMatch) =>
		match.lobbyId ? host.routes.match(match.lobbyId) : null;
	// A `lobbyId` is only set for matches with a stored replay.
	const replayOf = (lobbyId: string) =>
		({ id: lobbyId, kind: 'match', downloadCount: 0 }) as CommunityMatchDetail;

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

{#snippet ratingDeltaBadge(delta: number, className?: string)}
	{#if delta === 0}
		<span class={cn('text-secondary-600 tabular-nums', className)} aria-hidden="true">–</span>
	{:else}
		<span
			class={cn(
				'inline-flex items-center gap-0.5 font-semibold tabular-nums',
				delta > 0 ? 'text-green-300' : 'text-red-300',
				className
			)}
		>
			{#if delta > 0}
				<CaretUpIcon class="size-3" weight="fill" />
			{:else}
				<CaretDownIcon class="size-3" weight="fill" />
			{/if}
			{Math.abs(delta)}
		</span>
	{/if}
{/snippet}

{#snippet rankIcon(matchPlayer: MatchHistoryPlayer, className: string)}
	{#if (matchPlayer.ranklevel ?? 0) > 0}
		<RankIcon
			level={matchPlayer.ranklevel ?? 0}
			race={matchPlayer.race_id}
			position={matchPlayer.rank}
			class={className}
		/>
	{/if}
{/snippet}

{#snippet factionFlag(matchPlayer: MatchHistoryPlayer, className?: string)}
	<img
		loading="lazy"
		decoding="async"
		src={host.resolve.factionFlagByRace(matchPlayer.race_id)}
		alt=""
		class={cn(factionIcon, className)}
	/>
{/snippet}

{#snippet playerIdentity(matchPlayer: MatchHistoryPlayer, isSelf: boolean)}
	<div class="flex min-w-0 items-center gap-2">
		{#if showAvatars}
			<span class="border-secondary-800 size-8 shrink-0 overflow-hidden rounded-lg border">
				{#if matchPlayer.avatarUrl}
					<img
						loading="lazy"
						decoding="async"
						src={host.resolve.avatarUrl(matchPlayer.avatarUrl, { thumb: '100x100' })}
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
		<CountryFlag country={matchPlayer.country} class="h-4" />
		<PlayerLikeCount likeCount={matchPlayer.likeCount} class="shrink-0" />
		<PlayerNameIcons labels={matchPlayer.labels} steamId={matchPlayer.steamId} />
		{#if matchPlayer.steamId}
			<PlayerProfileLink
				href={host.routes.player(matchPlayer.steamId)}
				class={cn(
					interactive,
					'hover:text-primary min-w-0 truncate transition-colors',
					isSelf && 'text-primary font-semibold'
				)}
			>
				{matchPlayer.alias}
			</PlayerProfileLink>
		{:else}
			<span class={cn('min-w-0 truncate', isSelf && 'text-primary font-semibold')}>
				{matchPlayer.alias}
			</span>
		{/if}
		<EloBadge elo={displayElo(matchPlayer)} class="md:hidden" />
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
						{#if href && match.lobbyId}
							{@const replay = replayOf(match.lobbyId)}
							{@const downloadHref = host.api.replays.downloadHref(replay)}
							<Button {href} size="sm" variant="secondary">
								<FilmReelIcon class="text-primary size-4" weight="duotone" />
								{t('Watch replay')}
							</Button>
							<Button
								href={downloadHref ?? undefined}
								download={downloadHref ? '' : undefined}
								onclick={() => void host.api.replays.download(replay).catch(() => {})}
								size="icon-sm"
								variant="secondary"
								{@attach tooltip(t('Download replay'))}
								aria-label={t('Download replay')}
							>
								<DownloadSimpleIcon class="size-4" />
							</Button>
						{/if}
						<span class="text-secondary-300 flex items-center gap-2 text-sm font-medium">
							<ClockIcon class="size-4" />
							{formatDuration(match.startgametime, match.completiontime)}
						</span>
					</div>
				</div>
				<div role="table" aria-label={normalizeMapName(match.mapname)}>
					<div role="row" class={cn(grid, tableHeadRow, 'h-9')}>
						<div role="columnheader">{t('Pos')}</div>
						<div
							role="columnheader"
							class="hidden md:block"
							{@attach tooltip(t('Rating Change (elo)'))}
						>
							{t('Change')}
						</div>
						<div role="columnheader" class="hidden text-center md:block">{t('Rank')}</div>
						<div role="columnheader" class="hidden text-center md:block">{t('ELO')}</div>
						<div role="columnheader" class="hidden text-center md:block">{t('Team')}</div>
						<div role="columnheader">{t('Player')}</div>
						<div role="columnheader" class="hidden text-center md:block">{t('Games')}</div>
						<div role="columnheader" class="hidden text-center md:block">{t('Wins')}</div>
						<div role="columnheader" class="hidden text-center md:block">{t('Losses')}</div>
						<div role="columnheader" class="text-right">{t('Win rate')}</div>
						<div role="columnheader" class="hidden text-center md:block">{t('Streak')}</div>
					</div>
					<div role="rowgroup" class="-mb-px">
						{#each players as matchPlayer (matchPlayer.profile_id)}
							{@const isSelf = matchPlayer.profile_id === player.profileId}
							{@const delta = ratingDelta(matchPlayer)}
							<div
								role="row"
								class={cn(
									grid,
									'border-secondary-800/70 min-h-12 border-b py-2 text-white',
									matchPlayer.outcome === 1 ? 'bg-success/5' : 'bg-destructive/5',
									isSelf && 'shadow-[inset_3px_0_0_var(--color-primary)]'
								)}
							>
								<div role="cell" class="flex flex-col items-start leading-tight">
									<span
										class={cn(
											'text-sm font-semibold tabular-nums',
											isSelf ? 'text-primary' : 'text-secondary-300'
										)}
									>
										{(matchPlayer.rank ?? 0) > 0 ? `#${matchPlayer.rank}` : '–'}
									</span>
									{@render ratingDeltaBadge(delta, 'text-xs md:hidden')}
								</div>
								<div role="cell" class="hidden text-sm md:block">
									{@render ratingDeltaBadge(delta)}
								</div>
								<div role="cell" class="hidden items-center justify-center gap-1.5 md:flex">
									{#if (matchPlayer.ranklevel ?? 0) > 0}
										{@render rankIcon(matchPlayer, 'size-6')}
										<span class="text-secondary-400 text-sm tabular-nums">
											{matchPlayer.ranklevel}
										</span>
									{:else}
										<span class="text-secondary-600 tabular-nums">–</span>
									{/if}
								</div>
								<div role="cell" class="hidden justify-center md:flex">
									<EloBadge elo={displayElo(matchPlayer)} />
								</div>
								<div role="cell" class="hidden justify-center md:flex">
									{@render factionFlag(matchPlayer)}
								</div>
								<div role="cell" class="flex min-w-0 items-center gap-2 text-sm">
									{@render rankIcon(matchPlayer, 'size-6 shrink-0 md:hidden')}
									{@render factionFlag(matchPlayer, 'shrink-0 md:hidden')}
									{@render playerIdentity(matchPlayer, isSelf)}
								</div>
								<div
									role="cell"
									class="text-secondary-300 hidden text-center text-sm tabular-nums md:block"
								>
									{matchPlayer.wins + matchPlayer.losses}
								</div>
								<div role="cell" class={cn(statWins, 'hidden text-center text-sm md:block')}>
									{matchPlayer.wins}
								</div>
								<div role="cell" class={cn(statLosses, 'hidden text-center text-sm md:block')}>
									{matchPlayer.losses}
								</div>
								<div role="cell">
									<LeaderboardRecord
										wins={matchPlayer.wins}
										losses={matchPlayer.losses}
										compact
										bar={false}
										class="justify-end"
									/>
								</div>
								<div
									role="cell"
									class={cn(
										'hidden text-center text-sm font-medium md:block',
										statStreakClass(matchPlayer.streak)
									)}
								>
									{formatStreak(matchPlayer.streak)}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</section>
		{/each}
	</div>
{/if}
