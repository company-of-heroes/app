<script lang="ts">
	import { communityPlayerHref, displayMapName, replayDetailHref } from './links';
	import { useHost } from '../host/host.context';
	import { useI18n } from '@company-of-heroes/i18n';
	import MapImage from '../ui/map-image.svelte';
	import { Button } from '../ui/button';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, interactive, outcomeSurface } from '@company-of-heroes/ui/variants';
	import type { CommunityMatch, CommunityMatchDetail } from './types';
	import {
		formatDurationSeconds,
		formatMatchDate,
		matchDurationSeconds,
		matchModeLabel,
		teamOutcome,
		teamPlayers
	} from './utils';
	import { scoreClassName } from '../comment/vote';
	import ReplayProBadge from './replay-pro-badge.svelte';
	import PlayerLikeCount from '../player/player-like-count.svelte';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import PlayerStreamerIcon from '../player/player-streamer-icon.svelte';
	import { playerPreviewId } from '../player/player-preview-cache';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import ChatCircleIcon from 'phosphor-svelte/lib/ChatCircleIcon';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';

	type Props = {
		match: CommunityMatch;
		meSteamIds?: string[];
		class?: string;
	};

	const { t } = useI18n();
	const host = useHost();

	let { match, meSteamIds = [], class: className }: Props = $props();

	let downloadCount = $derived(match.downloadCount ?? 0);
	let downloading = $state(false);

	const detail = $derived<CommunityMatchDetail>({
		...match,
		durationSeconds: match.durationSeconds ?? null
	});
	const detailHref = $derived(replayDetailHref(match, host.routes));
	const downloadHref = $derived(host.api.replays.downloadHref(detail));
	const mapName = $derived(displayMapName(match.map, host));
	const title = $derived((match.kind === 'member' && match.title?.trim()) || mapName);
	const proTooltipLabel = (elo: number) => t('Pro gameplay · avg {elo} ELO', { elo });

	async function download() {
		if (downloading) {
			return;
		}

		downloading = true;
		try {
			const result = await host.api.replays.download(detail);
			if (result?.downloadCount != null) {
				downloadCount = result.downloadCount;
			}
		} catch {
			// The host reports download failures itself.
		} finally {
			downloading = false;
		}
	}
</script>

{#snippet team(side: 'allies' | 'axis')}
	<ul
		class={cn(
			'divide-secondary-800 flex min-w-0 flex-col divide-y',
			outcomeSurface(teamOutcome(match, side))
		)}
	>
		{#each teamPlayers(match, side) as player, index (`${player.steamId ?? player.profile.profile_id}:${index}`)}
			{@const playerHref = communityPlayerHref(player, host.routes)}
			{@const previewId = playerPreviewId({
				steamId: player.steamId,
				profileId: player.profile.profile_id > 0 ? player.profile.profile_id : null
			})}
			{@const isMe = !!player.steamId && meSteamIds.includes(player.steamId)}
			{@const ranked = match.isRanked && !!player.stats}
			{@const ranking = player.stats?.rank ?? 0}
			<li class="flex h-8 min-w-0 items-center gap-2 px-4 text-sm">
				{#if ranked}
					<img
						src={host.resolve.rankImageByRace(player.race ?? 0, player.stats?.rankLevel ?? 0)}
						alt=""
						class="size-5 shrink-0"
					/>
				{:else}
					<img
						src={host.resolve.factionFlagByRace(player.race ?? 0)}
						alt=""
						class={cn(factionIcon, '!size-4 ring-2')}
					/>
				{/if}
				<PlayerLikeCount likeCount={player.likeCount} class="shrink-0" />
				<PlayerStreamerIcon steamId={player.steamId} />
				{#if playerHref && previewId}
					<PlayerProfileLink
						href={playerHref}
						playerId={previewId}
						class={cn(
							interactive,
							'hover:text-primary min-w-0 truncate transition-colors',
							isMe ? 'text-primary font-semibold' : 'text-secondary-200'
						)}
					>
						{player.profile.alias || '—'}
					</PlayerProfileLink>
				{:else}
					<span class="text-secondary-400 min-w-0 truncate">{player.profile.alias || '—'}</span>
				{/if}
				{#if ranked}
					<span class="text-secondary-400 ms-auto shrink-0 text-xs tabular-nums">
						{ranking > 0 ? `#${ranking}` : '-'}
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<article class={cn('flex min-w-0 flex-col bg-gray-950', className)}>
	<a
		href={detailHref}
		class={cn(interactive, 'group relative block aspect-video flex-1 overflow-hidden')}
	>
		<MapImage
			map={match.map}
			resolveMapSrc={host.resolve.mapSrc}
			resolveFallbackSrc={host.resolve.mapFallbackSrc}
			alt={mapName}
			flush
			class="absolute inset-0 aspect-auto size-full opacity-50 transition-opacity duration-300 group-hover:opacity-70"
		/>
		<div
			class="pointer-events-none absolute inset-0 z-20 bg-linear-to-t from-gray-950 via-gray-950/60 to-transparent"
		></div>
		<div class="absolute inset-x-4 bottom-3 z-30 min-w-0">
			<p class="text-secondary-400 flex items-center gap-1.5 text-xs">
				{match.kind === 'member' ? t('Member replay') : t('Community match')}
				<ReplayProBadge {match} label={t('Pro')} tooltipLabel={proTooltipLabel} />
			</p>
			<p class="mt-0.5 flex min-w-0 items-center gap-2 font-medium text-white">
				<span class="group-hover:text-primary truncate transition-colors">{title}</span>
				{#if match.isRanked}
					<RankingIcon class="text-primary-100 shrink-0" weight="duotone" />
				{/if}
			</p>
			<p class="text-secondary-400 mt-0.5 truncate text-xs tabular-nums">
				{matchModeLabel(match)} · {formatDurationSeconds(matchDurationSeconds(match))} ·
				{formatMatchDate(match.createdAt, host.locale())}
			</p>
		</div>
	</a>
	<div class="divide-secondary-800 border-secondary-800 grid grid-cols-2 divide-x border-t">
		{@render team('allies')}
		{@render team('axis')}
	</div>
	<div class="border-secondary-800 flex items-center justify-between gap-3 border-t px-4 py-1.5">
		<div class="text-secondary-400 flex items-center gap-3 text-sm tabular-nums">
			<span
				class={cn(
					'inline-flex items-center gap-1',
					scoreClassName(match.likeCount ?? 0, 'text-secondary-400')
				)}
				title={t('Likes')}
			>
				<CaretUpIcon size={14} weight="fill" />
				{match.likeCount ?? 0}
			</span>
			<span class="inline-flex items-center gap-1" title={t('Comments')}>
				<ChatCircleIcon size={14} weight="duotone" />
				{match.commentCount ?? 0}
			</span>
			<span class="inline-flex items-center gap-1" title={t('Downloads')}>
				<DownloadIcon size={14} weight="duotone" />
				{downloadCount}
			</span>
		</div>
		<Button
			href={downloadHref ?? undefined}
			download={downloadHref ? '' : undefined}
			onclick={() => void download()}
			loading={downloading && !downloadHref}
			variant="ghost"
			size="icon-sm"
			class="text-secondary-400 hover:text-primary"
			title={t('Download replay')}
			aria-label={t('Download replay')}
		>
			<DownloadSimpleIcon class="size-4" />
		</Button>
	</div>
</article>
