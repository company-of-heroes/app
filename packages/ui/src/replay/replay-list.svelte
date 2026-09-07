<script lang="ts">
	import type { Component } from 'svelte';
	import MapImage from '../ui/map-image.svelte';
	import { Badge } from '../ui/badge';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		factionIcon,
		interactive,
		tableHeadRow,
		tableSortHeader
	} from '@company-of-heroes/ui/variants';
	import { tooltip } from '../attachments/tooltip.svelte';
	import type { CommunityMatch, CommunityPlayer, HistorySortDir, HistorySortField } from './types';
	import {
		formatDurationSeconds,
		formatMatchDate,
		matchDurationSeconds,
		teamOutcome,
		teamPlayers
	} from './utils';
	import { scoreClassName } from '../comment/vote';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import ChatCircleIcon from 'phosphor-svelte/lib/ChatCircleIcon';
	import ArrowDownIcon from 'phosphor-svelte/lib/ArrowDownIcon';
	import ArrowUpIcon from 'phosphor-svelte/lib/ArrowUpIcon';
	import ArrowsDownUpIcon from 'phosphor-svelte/lib/ArrowsDownUpIcon';

	type Props = {
		matches: CommunityMatch[];
		highlightedPlayers?: string[];
		meSteamIds?: string[];
		sort: HistorySortField;
		sortDir: HistorySortDir;
		onSort: (field: HistorySortField) => void;
		replayHref: (matchId: string) => string;
		playerHref: (player: CommunityPlayer) => string | null;
		resolveMapSrc: (map: string | undefined) => string | undefined;
		resolveFallbackSrc?: () => string | undefined;
		resolveFactionFlag: (race: number) => string;
		formatMapName: (map: string) => string;
		emptyMessage?: string;
		locale?: string;
		mapLabel?: string;
		alliesLabel?: string;
		axisLabel?: string;
		durationLabel?: string;
		likesLabel?: string;
		commentsLabel?: string;
		downloadsLabel?: string;
		dateLabel?: string;
		sortByLabel?: string;
		deletedLabel?: string;
	};

	let {
		matches,
		highlightedPlayers = [],
		meSteamIds = [],
		sort,
		sortDir,
		onSort,
		replayHref,
		playerHref,
		resolveMapSrc,
		resolveFallbackSrc,
		resolveFactionFlag,
		formatMapName,
		emptyMessage = 'No community replays found.',
		locale,
		mapLabel = 'Map',
		alliesLabel = 'Allies',
		axisLabel = 'Axis',
		durationLabel = 'Duration',
		likesLabel = 'Likes',
		commentsLabel = 'Comments',
		downloadsLabel = 'Downloads',
		dateLabel = 'Date',
		sortByLabel = 'Sort by {label}',
		deletedLabel = 'Deleted'
	}: Props = $props();

	function isMePlayer(player: CommunityPlayer) {
		return Boolean(player.steamId && meSteamIds.includes(player.steamId));
	}

	function outcomeClass(outcome: 'win' | 'loss' | null) {
		if (outcome === 'win') {
			return 'bg-green-500/5';
		}

		if (outcome === 'loss') {
			return 'bg-red-500/5';
		}

		return '';
	}

	function sortIcon(field: HistorySortField) {
		if (sort !== field) {
			return 'none' as const;
		}

		return sortDir;
	}

	function sortAria(field: HistorySortField) {
		if (sort !== field) {
			return 'none' as const;
		}

		return sortDir === 'asc' ? 'ascending' : 'descending';
	}

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

{#snippet sortHeader(field: HistorySortField, label: string)}
	<th class="w-2/24 px-4 py-2" aria-sort={sortAria(field)}>
		<button
			type="button"
			class={cn(tableSortHeader, 'justify-end gap-1')}
			aria-label={sortByLabel.replace('{label}', label)}
			onclick={() => onSort(field)}
		>
			{label}
			{#if sortIcon(field) === 'desc'}
				<ArrowDownIcon size={14} class="shrink-0" weight="duotone" />
			{:else if sortIcon(field) === 'asc'}
				<ArrowUpIcon size={14} class="shrink-0" weight="duotone" />
			{:else}
				<ArrowsDownUpIcon size={14} class="shrink-0" weight="duotone" />
			{/if}
		</button>
	</th>
{/snippet}

{#snippet playerFlag(player: CommunityPlayer, className: string)}
	{@const label = player.profile.alias}
	<img
		src={resolveFactionFlag(player.race ?? 0)}
		alt={label}
		class={className}
		{@attach tooltip(label)}
	/>
{/snippet}

{#snippet teamFlags(match: CommunityMatch, team: 'allies' | 'axis')}
	<div class="flex items-center gap-2">
		{#each teamPlayers(match, team) as player (player.profile.profile_id)}
			{@const href = playerHref(player)}
			{@const isMe = isMePlayer(player)}
			{@const highlighted = highlightedPlayers.includes(String(player.profile.profile_id))}
			{@const flagClass = cn(
				factionIcon,
				'hover:ring-secondary-700 transition-all hover:opacity-100 hover:grayscale-0',
				isMe || highlighted ? 'grayscale-0' : 'opacity-50 grayscale-80',
				isMe && 'ring-primary',
				!isMe && highlighted && 'ring-info'
			)}
			{#if href}
				<a {href} class={cn(interactive, 'shrink-0 rounded-full')}>
					{@render playerFlag(player, flagClass)}
				</a>
			{:else}
				{@render playerFlag(player, flagClass)}
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet teamCell(match: CommunityMatch, team: 'allies' | 'axis')}
	<td class={cn('px-4 py-0', outcomeClass(teamOutcome(match, team)))}>
		{@render teamFlags(match, team)}
	</td>
{/snippet}

{#snippet scoreCell(count: number)}
	<td class="px-4 py-0 text-right tabular-nums">
		<span
			class={cn(
				'inline-flex items-center justify-end gap-1.5',
				scoreClassName(count, 'text-secondary-400')
			)}
		>
			<CaretUpIcon size={16} weight="fill" />
			{count}
		</span>
	</td>
{/snippet}

{#snippet countCell(count: number, Icon: Component)}
	<td class="text-secondary-400 px-4 py-0 text-right tabular-nums">
		<span class="inline-flex items-center justify-end gap-1.5">
			<Icon size={16} weight="duotone" />
			{count}
		</span>
	</td>
{/snippet}

{#if matches.length === 0}
	<p class="text-secondary-400 px-4 py-3 text-sm">{emptyMessage}</p>
{:else}
	<div class="hidden overflow-x-auto md:block">
		<table class="w-full table-fixed border-collapse text-sm">
			<thead class="border-secondary-800 border-b">
				<tr class="{tableHeadRow} text-left">
					<th class="w-6/24 px-4 py-2">{mapLabel}</th>
					<th class="w-3/24 px-4 py-2">{alliesLabel}</th>
					<th class="w-3/24 px-4 py-2">{axisLabel}</th>
					<th class="w-2/24 px-4 py-2">{durationLabel}</th>
					{@render sortHeader('likeCount', likesLabel)}
					{@render sortHeader('commentCount', commentsLabel)}
					{@render sortHeader('downloadCount', downloadsLabel)}
					<th class="w-4/24 px-4 py-2 text-end">{dateLabel}</th>
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
						<td class="overflow-clip py-0 pr-0 pl-4">
							<a
								href={replayHref(match.id)}
								class={cn(interactive, 'flex h-11 min-w-0 items-center gap-0')}
							>
								<MapImage
									map={match.map}
									{resolveMapSrc}
									{resolveFallbackSrc}
									alt={formatMapName(match.map)}
									small
									flush
								/>
								<div class="flex min-w-0 items-center gap-2 px-4">
									<span class="min-w-0 truncate font-medium">{rowLabel(match)}</span>
									{#if match.isRanked}
										<RankingIcon class="text-primary-100 shrink-0" weight="duotone" />
									{/if}
									{#if match.visibility === 'deleted'}
										<Badge variant="warning" class="shrink-0">{deletedLabel}</Badge>
									{/if}
								</div>
							</a>
						</td>
						{@render teamCell(match, 'allies')}
						{@render teamCell(match, 'axis')}
						<td class="text-secondary-400 px-4 py-0 tabular-nums">
							<a href={replayHref(match.id)} class={cn(interactive, 'hover:text-white')}>
								{formatDurationSeconds(matchDurationSeconds(match))}
							</a>
						</td>
						{@render scoreCell(match.likeCount ?? 0)}
						{@render countCell(match.commentCount ?? 0, ChatCircleIcon)}
						{@render countCell(match.downloadCount ?? 0, DownloadIcon)}
						<td class="text-secondary-400 px-4 py-0 text-end text-sm tabular-nums">
							{formatMatchDate(match.createdAt, locale)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="md:hidden divide-y border-secondary-800">
		{#each matches as match (match.id)}
			<div
				class={cn(
					'px-4 py-3 text-white',
					match.visibility === 'deleted' && 'opacity-50'
				)}
			>
				<a
					href={replayHref(match.id)}
					class={cn(interactive, 'flex min-w-0 items-center gap-0')}
				>
					<MapImage
						map={match.map}
						{resolveMapSrc}
						{resolveFallbackSrc}
						alt={formatMapName(match.map)}
						small
						flush
					/>
					<div class="flex min-w-0 items-center gap-2 px-3">
						<span class="min-w-0 truncate font-medium">{rowLabel(match)}</span>
						{#if match.isRanked}
							<RankingIcon class="text-primary-100 shrink-0" weight="duotone" />
						{/if}
						{#if match.visibility === 'deleted'}
							<Badge variant="warning" class="shrink-0">{deletedLabel}</Badge>
						{/if}
					</div>
				</a>
				<div class="mt-2 flex items-center gap-4">
					<div class={cn('rounded px-1 py-0.5', outcomeClass(teamOutcome(match, 'allies')))}>
						{@render teamFlags(match, 'allies')}
					</div>
					<div class={cn('rounded px-1 py-0.5', outcomeClass(teamOutcome(match, 'axis')))}>
						{@render teamFlags(match, 'axis')}
					</div>
				</div>
				<div class="text-secondary-400 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
					<a href={replayHref(match.id)} class={cn(interactive, 'hover:text-white')}>
						{formatDurationSeconds(matchDurationSeconds(match))}
					</a>
					<span>{formatMatchDate(match.createdAt, locale)}</span>
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
