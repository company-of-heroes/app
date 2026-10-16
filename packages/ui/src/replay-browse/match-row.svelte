<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, outcomeSurface } from '@company-of-heroes/ui/variants';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import ChatCircleIcon from 'phosphor-svelte/lib/ChatCircleIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import { tooltip } from '../attachments';
	import { scoreClassName } from '../comment/vote';
	import { formatRelative } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import MapImage from '../ui/map-image.svelte';
	import { displayMapName, replayDetailHref } from '../replay/links';
	import ReplayProBadge from '../replay/replay-pro-badge.svelte';
	import ReplayTeam from '../replay/replay-team.svelte';
	import type { CommunityMatch } from '../replay/types';
	import {
		formatDurationSeconds,
		formatMatchDate,
		matchDurationSeconds,
		teamOutcome
	} from '../replay/utils';
	import { matchupLabel, unixSeconds } from './utils';
	import WatchButton from './watch-button.svelte';

	type Props = {
		match: CommunityMatch;
		meSteamIds?: string[];
		highlightedPlayers?: string[];
		/** Likes, comments and downloads; off for local replays. */
		showEngagement?: boolean;
		/** Replaces the counters and download button (e.g. library actions). */
		actions?: Snippet;
		/** Extra chips after the mode, e.g. "Published". */
		badges?: Snippet;
		/** Detail link; defaults to the match or member replay page. */
		href?: string;
	};

	const { t } = useI18n();
	const host = useHost();

	let {
		match,
		meSteamIds = [],
		highlightedPlayers = [],
		showEngagement = true,
		actions,
		badges,
		href
	}: Props = $props();

	let downloadCount = $derived(match.downloadCount ?? 0);

	const detailHref = $derived(href ?? replayDetailHref(match, host.routes));
	const mapName = $derived(displayMapName(match.map, host));
	const title = $derived(match.title?.trim() || mapName);
	const matchup = $derived(matchupLabel(match));
	const duration = $derived(matchDurationSeconds(match));
	const createdAt = $derived(unixSeconds(match.createdAt));
	const when = $derived(createdAt ? formatRelative(createdAt, host.locale()) : '');
	const proTooltipLabel = (elo: number) => t('Pro gameplay · avg {elo} ELO', { elo });
	/** Community matches without a replay file have nothing to download. */
	const watchable = $derived(
		match.kind === 'member' || (match as { hasReplay?: boolean }).hasReplay !== false
	);

	const chip =
		'border-secondary-700/60 bg-secondary-900/60 text-secondary-200 inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[11px] font-semibold';
</script>

<!-- One side of the face-off, tinted by its result; names point at the VS. -->
{#snippet team(side: 'allies' | 'axis')}
	<div class={cn('min-w-0 rounded-md px-2.5 py-2', outcomeSurface(teamOutcome(match, side)))}>
		<div
			class={cn(
				'text-secondary-500 mb-1 text-[11px] font-semibold tracking-wider uppercase',
				side === 'allies' && 'text-end'
			)}
		>
			{side === 'allies' ? t('Allies') : t('Axis')}
		</div>
		<ReplayTeam
			{match}
			{side}
			{meSteamIds}
			{highlightedPlayers}
			showNotes={false}
			mirrored={side === 'allies'}
			itemClass="h-6"
		/>
	</div>
{/snippet}

<article
	class={cn(
		'group/row border-secondary-800 grid border-b transition-colors duration-200',
		'hover:bg-secondary-950/50',
		'lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_minmax(10rem,12rem)]',
		match.visibility === 'deleted' && 'opacity-50'
	)}
>
	<a href={detailHref} class={cn(interactive, 'flex min-w-0 items-center gap-3 px-4 pt-4 lg:py-4')}>
		<MapImage
			map={match.map}
			resolveMapSrc={host.resolve.mapSrc}
			resolveFallbackSrc={host.resolve.mapFallbackSrc}
			alt={mapName}
			small
			flush
			class="size-16 rounded-md ring-1 ring-white/5"
		/>
		<div class="min-w-0">
			<p
				class="font-heading group-hover/row:text-primary truncate font-bold text-white transition-colors"
			>
				{title}
			</p>
			{#if title !== mapName}
				<p class="text-secondary-400 truncate text-xs">{mapName}</p>
			{/if}
			<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
				{#if matchup}
					<span class={chip}>{matchup}</span>
				{/if}
				{#if match.isRanked}
					<span class={chip}>
						<RankingIcon class="text-primary-100 size-3" weight="duotone" />
						{t('Ranked')}
					</span>
				{/if}
				<ReplayProBadge {match} label={t('Pro')} tooltipLabel={proTooltipLabel} />
				{#if match.visibility === 'deleted'}
					<Badge variant="warning">{t('Deleted')}</Badge>
				{/if}
				{@render badges?.()}
			</div>
		</div>
	</a>

	<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 px-2 py-3">
		{@render team('allies')}
		<span class="font-heading text-secondary-600 text-xs font-bold" aria-hidden="true">VS</span>
		{@render team('axis')}
	</div>

	<div
		class={cn(
			'border-secondary-800/60 flex items-center justify-between gap-3 border-t px-4 py-2.5 text-sm',
			'lg:flex-col lg:items-end lg:justify-center lg:gap-2 lg:border-t-0 lg:py-4'
		)}
	>
		<div class="flex items-center gap-3 tabular-nums lg:flex-col lg:items-end lg:gap-0.5">
			{#if duration}
				<span class="text-secondary-200 inline-flex items-center gap-1">
					<ClockIcon class="size-3.5" weight="bold" />
					{formatDurationSeconds(duration)}
				</span>
			{/if}
			{#if when}
				<span
					class="text-secondary-500 text-xs"
					{@attach tooltip(formatMatchDate(match.createdAt, host.locale()))}
				>
					{when}
				</span>
			{/if}
		</div>
		{#if actions}
			<div class="flex items-center gap-0.5">{@render actions()}</div>
		{:else}
			<div class="text-secondary-400 flex items-center gap-3 tabular-nums">
				{#if showEngagement}
					<span
						class={cn(
							'inline-flex items-center gap-1',
							scoreClassName(match.likeCount ?? 0, 'text-secondary-400')
						)}
						{@attach tooltip(t('Likes'))}
					>
						<CaretUpIcon size={14} weight="fill" />
						{match.likeCount ?? 0}
					</span>
					<span class="inline-flex items-center gap-1" {@attach tooltip(t('Comments'))}>
						<ChatCircleIcon size={14} weight="duotone" />
						{match.commentCount ?? 0}
					</span>
					<span class="inline-flex items-center gap-1" {@attach tooltip(t('Downloads'))}>
						<DownloadIcon size={14} weight="duotone" />
						{downloadCount}
					</span>
				{/if}
				{#if watchable}
					<WatchButton {match} variant="icon" onDownloaded={(count) => (downloadCount = count)} />
				{/if}
			</div>
		{/if}
	</div>
</article>
