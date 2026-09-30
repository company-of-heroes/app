<script lang="ts">
	import { communityPlayerHref, displayMapName, replayDetailHref } from './links';
	import { useHost } from '../host/host.context';
	import { useI18n } from '@company-of-heroes/i18n';
	import MapImage from '../ui/map-image.svelte';
	import { Badge } from '../ui/badge';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, tableHeadRow } from '@company-of-heroes/ui/variants';
	import type { CommunityMatch, CommunityPlayer, HistorySortDir, HistorySortField } from './types';
	import {
		formatDurationSeconds,
		formatMatchDate,
		matchDurationSeconds,
		matchModeLabel,
		teamOutcome,
		teamPlayers
	} from './utils';
	import { scoreClassName } from '../comment/vote';
	import TeamPlayerSkills from '../match/team-player-skills.svelte';
	import ReplayProBadge from './replay-pro-badge.svelte';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import ChatCircleIcon from 'phosphor-svelte/lib/ChatCircleIcon';

	type Props = {
		matches: CommunityMatch[];
		highlightedPlayers?: string[];
		meSteamIds?: string[];
		sort: HistorySortField;
		sortDir: HistorySortDir;
		onSort: (field: HistorySortField) => void;
		emptyMessage?: string;
		mapLabel?: string;
	};

	const { t } = useI18n();
	const host = useHost();

	let {
		matches,
		highlightedPlayers = [],
		meSteamIds = [],
		sort: _sort,
		sortDir: _sortDir,
		onSort: _onSort,
		emptyMessage = t('No community replays found.'),
		mapLabel = t('Map')
	}: Props = $props();

	const replayHref = (match: CommunityMatch) => replayDetailHref(match, host.routes);
	const playerHref = (player: CommunityPlayer) => communityPlayerHref(player, host.routes);
	const formatMapName = (map: string) => displayMapName(map, host);
	const proTooltipLabel = (elo: number) => t('Pro gameplay · avg {elo} ELO', { elo });

	function rowLabel(match: CommunityMatch) {
		if (match.kind === 'member') {
			const title = match.title?.trim();
			if (title) {
				return title;
			}
		}

		return formatMapName(match.map);
	}
</script>

{#snippet teamFlags(match: CommunityMatch, team: 'allies' | 'axis')}
	<TeamPlayerSkills
		players={teamPlayers(match, team).map((player) => ({
			race: player.race,
			alias: player.profile.alias,
			steamId: player.steamId,
			profileId: player.profile.profile_id,
			// Basic Match — badges off via showRankBadges; stats stay for preview.
			stats: player.stats,
			href: playerHref(player)
		}))}
		{meSteamIds}
		{highlightedPlayers}
		outcome={teamOutcome(match, team)}
		modeLabel={matchModeLabel(match)}
		showRankBadges={match.isRanked}
	/>
{/snippet}

{#snippet engagementCell(match: CommunityMatch)}
	<td class="px-4 py-0 text-right whitespace-nowrap tabular-nums">
		<div class="text-secondary-400 inline-flex items-center justify-end gap-3">
			<span
				class={cn(
					'inline-flex items-center gap-1.5',
					scoreClassName(match.likeCount ?? 0, 'text-secondary-400')
				)}
			>
				<CaretUpIcon size={16} weight="fill" />
				{match.likeCount ?? 0}
			</span>
			<span class="inline-flex items-center gap-1.5">
				<ChatCircleIcon size={16} weight="duotone" />
				{match.commentCount ?? 0}
			</span>
			<span class="inline-flex items-center gap-1.5">
				<DownloadIcon size={16} weight="duotone" />
				{match.downloadCount ?? 0}
			</span>
		</div>
	</td>
{/snippet}

{#if matches.length === 0}
	<p class="text-secondary-400 px-4 py-3 text-sm">{emptyMessage}</p>
{:else}
	<div class="hidden overflow-x-auto md:block">
		<table class="w-full table-auto border-collapse text-sm">
			<thead class="border-secondary-800 border-b">
				<tr class="{tableHeadRow} text-left">
					<th class="w-full px-4 py-2">{mapLabel}</th>
					<th class="px-4 py-2 whitespace-nowrap">{t('Type')}</th>
					<th class="px-2 py-2 whitespace-nowrap">{t('Allies')}</th>
					<th class="px-2 py-2 whitespace-nowrap">{t('Axis')}</th>
					<th class="px-4 py-2 whitespace-nowrap">{t('Duration')}</th>
					<th class="px-4 py-2 whitespace-nowrap"></th>
					<th class="px-4 py-2 text-end whitespace-nowrap">{t('Date')}</th>
				</tr>
			</thead>
			<tbody>
				{#each matches as match (match.id)}
					<tr
						class={cn(
							'border-secondary-800/70 hover:bg-secondary-950/50 h-11 border-t text-white',
							match.visibility === 'deleted' && 'opacity-50'
						)}
					>
						<td class="w-full overflow-clip py-0 pr-0 pl-4">
							<a
								href={replayHref(match)}
								class={cn(interactive, 'flex h-11 min-w-0 items-center gap-0')}
							>
								<MapImage
									map={match.map}
									resolveMapSrc={host.resolve.mapSrc}
									resolveFallbackSrc={host.resolve.mapFallbackSrc}
									alt={formatMapName(match.map)}
									small
									flush
								/>
								<div class="flex min-w-0 items-center gap-2 px-4">
									<span class="min-w-0 truncate font-medium">{rowLabel(match)}</span>
									{#if match.isRanked}
										<RankingIcon class="text-primary-100 shrink-0" weight="duotone" />
									{/if}
									<ReplayProBadge {match} label={t('Pro')} tooltipLabel={proTooltipLabel} />
									{#if match.visibility === 'deleted'}
										<Badge variant="warning" class="shrink-0">{t('Deleted')}</Badge>
									{/if}
								</div>
							</a>
						</td>
						<td class="text-secondary-400 px-4 py-0 whitespace-nowrap">
							{matchModeLabel(match)}
						</td>
						<td class="px-2 py-0 whitespace-nowrap">
							{@render teamFlags(match, 'allies')}
						</td>
						<td class="px-2 py-0 whitespace-nowrap">
							{@render teamFlags(match, 'axis')}
						</td>
						<td class="text-secondary-400 px-4 py-0 whitespace-nowrap tabular-nums">
							<a href={replayHref(match)} class={cn(interactive, 'hover:text-white')}>
								{formatDurationSeconds(matchDurationSeconds(match))}
							</a>
						</td>
						{@render engagementCell(match)}
						<td
							class="text-secondary-400 px-4 py-0 text-end text-sm whitespace-nowrap tabular-nums"
						>
							{formatMatchDate(match.createdAt, host.locale())}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="divide-secondary-800 divide-y md:hidden">
		{#each matches as match (match.id)}
			<div class={cn('px-4 py-3 text-white', match.visibility === 'deleted' && 'opacity-50')}>
				<a href={replayHref(match)} class={cn(interactive, 'flex min-w-0 items-center gap-0')}>
					<MapImage
						map={match.map}
						resolveMapSrc={host.resolve.mapSrc}
						resolveFallbackSrc={host.resolve.mapFallbackSrc}
						alt={formatMapName(match.map)}
						small
						flush
					/>
					<div class="flex min-w-0 items-center gap-2 px-3">
						<span class="min-w-0 truncate font-medium">{rowLabel(match)}</span>
						{#if match.isRanked}
							<RankingIcon class="text-primary-100 shrink-0" weight="duotone" />
						{/if}
						<ReplayProBadge {match} label={t('Pro')} tooltipLabel={proTooltipLabel} />
						{#if match.visibility === 'deleted'}
							<Badge variant="warning" class="shrink-0">{t('Deleted')}</Badge>
						{/if}
					</div>
				</a>
				<div class="mt-2 flex items-center gap-4">
					{@render teamFlags(match, 'allies')}
					{@render teamFlags(match, 'axis')}
				</div>
				<div
					class="text-secondary-400 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums"
				>
					<span>{matchModeLabel(match)}</span>
					<a href={replayHref(match)} class={cn(interactive, 'hover:text-white')}>
						{formatDurationSeconds(matchDurationSeconds(match))}
					</a>
					<span>{formatMatchDate(match.createdAt, host.locale())}</span>
				</div>
				<div class="text-secondary-400 mt-1.5 flex items-center gap-3 text-sm tabular-nums">
					<span
						class={cn(
							'inline-flex items-center gap-1',
							scoreClassName(match.likeCount ?? 0, 'text-secondary-400')
						)}
					>
						<CaretUpIcon size={14} weight="fill" />
						{match.likeCount ?? 0}
					</span>
					<span class="inline-flex items-center gap-1">
						<ChatCircleIcon size={14} weight="duotone" />
						{match.commentCount ?? 0}
					</span>
					<span class="inline-flex items-center gap-1">
						<DownloadIcon size={14} weight="duotone" />
						{match.downloadCount ?? 0}
					</span>
				</div>
			</div>
		{/each}
	</div>
{/if}
