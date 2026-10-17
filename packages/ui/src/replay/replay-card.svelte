<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, outcomeSurface } from '@company-of-heroes/ui/variants';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import ChatCircleIcon from 'phosphor-svelte/lib/ChatCircleIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import UsersThreeIcon from 'phosphor-svelte/lib/UsersThreeIcon';
	import { tooltip } from '../attachments';
	import { scoreClassName } from '../comment/vote';
	import { formatRelative } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import MapImage from '../ui/map-image.svelte';
	import { matchupLabel, unixSeconds } from '../replay-browse/utils';
	import WatchButton from '../replay-browse/watch-button.svelte';
	import { displayMapName, replayDetailHref } from './links';
	import ReplayProBadge from './replay-pro-badge.svelte';
	import ReplayTeam from './replay-team.svelte';
	import type { CommunityMatch } from './types';
	import { formatDurationSeconds, matchDurationSeconds, teamOutcome } from './utils';

	type Props = {
		match: CommunityMatch;
		meSteamIds?: string[];
		highlightedPlayers?: string[];
		/** Accent chip on the art, e.g. "Featured". */
		label?: string;
		/** Likes, comments and downloads; off for local replays. */
		showEngagement?: boolean;
		/** Replaces the counters and download button (e.g. library actions). */
		actions?: Snippet;
		/** Extra chips on the art, e.g. "Published". */
		badges?: Snippet;
		/** Detail link; defaults to the match or member replay page. */
		href?: string;
		class?: string;
	};

	const { t } = useI18n();
	const host = useHost();

	let {
		match,
		meSteamIds = [],
		highlightedPlayers = [],
		label,
		showEngagement = true,
		actions,
		badges,
		href,
		class: className
	}: Props = $props();

	let downloadCount = $derived(match.downloadCount ?? 0);

	const detailHref = $derived(href ?? replayDetailHref(match, host.routes));
	const mapName = $derived(displayMapName(match.map, host));
	const shared = $derived(match.kind === 'member');
	const title = $derived((shared && match.title?.trim()) || mapName);
	const matchup = $derived(matchupLabel(match));
	const duration = $derived(matchDurationSeconds(match));
	const uploader = $derived(shared ? (match.uploadedBy ?? null) : null);
	const createdAt = $derived(unixSeconds(match.createdAt));
	const when = $derived(createdAt ? formatRelative(createdAt, host.locale()) : '');
	const proTooltipLabel = (elo: number) => t('Pro gameplay · avg {elo} ELO', { elo });
	/** Community matches without a replay file have nothing to download. */
	const watchable = $derived(
		match.kind === 'member' || (match as { hasReplay?: boolean }).hasReplay !== false
	);

	const chip =
		'inline-flex h-6 items-center gap-1 rounded bg-gray-950/80 px-2 text-xs font-semibold text-white backdrop-blur-sm';
</script>

{#snippet team(side: 'allies' | 'axis')}
	<div class={cn('flex min-w-0 flex-col py-2', outcomeSurface(teamOutcome(match, side)))}>
		<div
			class="text-secondary-500 flex h-5 items-center px-3 text-[10px] font-semibold tracking-wider uppercase"
		>
			{side === 'allies' ? t('Allies') : t('Axis')}
		</div>
		<ReplayTeam
			{match}
			{side}
			{meSteamIds}
			{highlightedPlayers}
			showNotes={false}
			itemClass="h-7 gap-2 px-3"
			iconClass="!size-4 ring-0"
		/>
	</div>
{/snippet}

<article
	class={cn(
		'group/card relative flex h-full min-w-0 flex-col bg-gray-950 transition-colors duration-200',
		'hover:bg-secondary-950/50',
		match.visibility === 'deleted' && 'opacity-50',
		className
	)}
>
	<a href={detailHref} class={cn(interactive, 'relative block aspect-video overflow-hidden')}>
		<MapImage
			map={match.map}
			resolveMapSrc={host.resolve.mapSrc}
			resolveFallbackSrc={host.resolve.mapFallbackSrc}
			alt={mapName}
			flush
			class="absolute inset-0 aspect-auto size-full opacity-60 transition duration-500 group-hover/card:scale-[1.04] group-hover/card:opacity-85 motion-reduce:transition-none"
		/>
		<div
			class="pointer-events-none absolute inset-0 z-20 bg-linear-to-t from-gray-950 via-gray-950/50 to-gray-950/10"
		></div>
		<div class="absolute inset-x-3 top-3 z-30 flex items-start justify-between gap-2">
			<div class="flex min-w-0 flex-wrap items-center gap-1.5">
				{#if label}
					<span class={cn(chip, 'bg-primary text-gray-950')}>{label}</span>
				{/if}
				{#if matchup}
					<span class={chip}>{matchup}</span>
				{/if}
				<ReplayProBadge {match} label={t('Pro')} tooltipLabel={proTooltipLabel} />
				{#if match.visibility === 'deleted'}
					<Badge variant="warning">{t('Deleted')}</Badge>
				{/if}
				{@render badges?.()}
			</div>
			{#if duration}
				<span class={cn(chip, 'shrink-0 tabular-nums')}>
					<ClockIcon class="size-3.5" weight="bold" />
					{formatDurationSeconds(duration)}
				</span>
			{/if}
		</div>
		<div class="absolute inset-x-4 bottom-3 z-30 min-w-0">
			{#if title !== mapName}
				<p class="text-secondary-300 truncate text-xs">{mapName}</p>
			{/if}
			<h3
				class="font-heading group-hover/card:text-primary truncate text-sm font-bold text-white transition-colors"
			>
				{title}
			</h3>
		</div>
	</a>

	<div class="mt-3 flex h-6 min-w-0 items-center gap-2 px-4 text-sm">
		{#if uploader}
			{#if uploader.avatarUrl}
				<img
					src={uploader.avatarUrl}
					alt=""
					loading="lazy"
					decoding="async"
					class="size-6 shrink-0 rounded-full object-cover"
				/>
			{:else}
				<span
					class="bg-secondary-800 text-secondary-200 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase"
				>
					{uploader.alias.slice(0, 1)}
				</span>
			{/if}
			<span class="min-w-0 truncate font-medium text-white">{uploader.alias}</span>
		{:else}
			<UsersThreeIcon class="text-secondary-400 size-5 shrink-0" weight="duotone" />
			<span class="text-secondary-300 min-w-0 truncate">{t('Community match')}</span>
		{/if}
		{#if when}
			<span class="text-secondary-500 shrink-0">· {when}</span>
		{/if}
	</div>

	<!-- Teams side by side: a 4v4 is four lines high, so cards in a row stay close in height. -->
	<div
		class="border-secondary-800 divide-secondary-800 mt-3 grid flex-1 grid-cols-2 divide-x border-t"
	>
		{@render team('allies')}
		{@render team('axis')}
	</div>

	<div
		class="border-secondary-800 mt-auto flex items-center justify-between gap-3 border-t px-4 py-2"
	>
		<div class="text-secondary-400 flex items-center gap-3 text-sm tabular-nums">
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
		</div>
		{#if actions}
			<div class="flex items-center gap-0.5">{@render actions()}</div>
		{:else if watchable}
			<WatchButton {match} variant="icon" onDownloaded={(count) => (downloadCount = count)} />
		{/if}
	</div>
</article>
