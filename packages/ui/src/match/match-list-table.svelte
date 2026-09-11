<script lang="ts">
	import type { Snippet } from 'svelte';
	import MapImage from '../ui/map-image.svelte';
	import { Button } from '../ui/button';
	import { Skeleton } from '../ui/skeleton';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, tableHeadRow } from '@company-of-heroes/ui/variants';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import MinusIcon from 'phosphor-svelte/lib/MinusIcon';
	import LiveLobbyPlayers from '../live-lobby/live-lobby-players.svelte';
	import { hasLiveLobbyStats } from '../live-lobby/stats';
	import {
		defaultLiveLobbyPlayerLabel,
		teamPlayers,
		type LiveLobbyPlayer
	} from '../live-lobby/types';
	import { DEFAULT_MATCH_LIST_COLUMNS, type MatchListColumnId, type MatchListRow } from './types';
	import { defaultFormatDuration } from './utils';
	import TeamPlayerSkills from './team-player-skills.svelte';

	type Props = {
		rows: MatchListRow[];
		loading?: boolean;
		columns?: MatchListColumnId[];
		meSteamIds?: string[];
		highlightedPlayers?: string[];
		resolveMapSrc: (map: string | undefined) => string | undefined;
		resolveFallbackSrc?: () => string | undefined;
		resolveFactionFlag: (race: number) => string;
		getRankImage?: (race: number, rankLevel: number) => string;
		formatMapName: (map: string) => string;
		formatStarted?: (createdAt: string) => string;
		formatDate?: (createdAt: string) => string;
		formatDuration?: (seconds: number | null | undefined) => string;
		playerHref: (player: LiveLobbyPlayer) => string | null;
		playerLabel?: (player: LiveLobbyPlayer) => string;
		detailsHref?: (row: MatchListRow) => string | null | undefined;
		expandContent?: Snippet<[{ row: MatchListRow }]>;
		emptyMessage?: string;
		class?: string;
		footer?: Snippet;
		mapLabel?: string;
		nameLabel?: string;
		typeLabel?: string;
		alliesLabel?: string;
		axisLabel?: string;
		hostLabel?: string;
		startedLabel?: string;
		dateLabel?: string;
		durationLabel?: string;
		ratingLabel?: string;
		unknownHostLabel?: string;
		detailsLabel?: string;
		eloLabel?: string;
		levelLabel?: string;
		posLabel?: string;
		winsLabel?: string;
		lossesLabel?: string;
		streakLabel?: string;
	};

	let {
		rows,
		loading = false,
		columns: columnIds,
		meSteamIds = [],
		highlightedPlayers = [],
		resolveMapSrc,
		resolveFallbackSrc,
		resolveFactionFlag,
		getRankImage,
		formatMapName,
		formatStarted = (createdAt) => createdAt,
		formatDate,
		formatDuration = defaultFormatDuration,
		playerHref,
		playerLabel = defaultLiveLobbyPlayerLabel,
		detailsHref,
		expandContent,
		emptyMessage = 'No matches.',
		class: className,
		footer,
		mapLabel = 'Map',
		nameLabel = 'Name',
		typeLabel = 'Type',
		alliesLabel = 'Allies',
		axisLabel = 'Axis',
		hostLabel = 'Host',
		startedLabel = 'Started at',
		dateLabel = 'Date',
		durationLabel = 'Duration',
		ratingLabel = 'Rating',
		unknownHostLabel = 'Unknown',
		detailsLabel = 'Details',
		eloLabel = 'ELO',
		levelLabel = 'Level',
		posLabel = 'Pos',
		winsLabel = 'W',
		lossesLabel = 'L',
		streakLabel = 'Streak'
	}: Props = $props();

	let expandedId = $state<string | null>(null);

	const columns = $derived(columnIds?.length ? columnIds : DEFAULT_MATCH_LIST_COLUMNS);
	const canExpand = $derived(columns.includes('expand'));
	const showActions = $derived(columns.includes('actions'));
	const columnCount = $derived(columns.length);

	const headerById: Record<MatchListColumnId, string> = $derived({
		map: mapLabel,
		name: nameLabel,
		type: typeLabel,
		allies: alliesLabel,
		axis: axisLabel,
		host: hostLabel,
		started: startedLabel,
		date: dateLabel,
		duration: durationLabel,
		rating: ratingLabel,
		actions: '',
		expand: ''
	});

	function toggleExpanded(id: string) {
		if (!canExpand) {
			return;
		}

		expandedId = expandedId === id ? null : id;
	}

	function handleRowClick(event: MouseEvent, id: string) {
		const target = event.target as HTMLElement;
		if (target.closest('a, button')) {
			return;
		}

		toggleExpanded(id);
	}

	function handleRowKeydown(event: KeyboardEvent, id: string) {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}

		const target = event.target as HTMLElement;
		if (target.closest('a, button')) {
			return;
		}

		event.preventDefault();
		toggleExpanded(id);
	}
</script>

{#snippet factionFlags(
		players: LiveLobbyPlayer[],
		outcome?: 'win' | 'loss' | null,
		isRanked = true,
		modeLabel?: string | null
	)}
	<TeamPlayerSkills
		players={players.map((player) => ({
			race: player.race,
			alias: playerLabel(player),
			steamId: player.steamId,
			profileId: player.profileId,
			stats: player.stats,
			href: playerHref(player),
			country: player.country
		}))}
		{resolveFactionFlag}
		{getRankImage}
		{meSteamIds}
		{highlightedPlayers}
		{outcome}
		{modeLabel}
		showRankBadges={isRanked}
	/>
{/snippet}

{#snippet ratingCell(row: MatchListRow)}
	{@const change = row.ratingChange}
	{#if change != null && Number.isFinite(change)}
		<span class="inline-flex items-center gap-1 text-sm">
			{#if change < 0}
				<CaretDownIcon class="inline-block text-red-400" weight="duotone" />
				<span class="text-red-200">{Math.abs(change)}</span>
			{:else if change > 0}
				<CaretUpIcon class="text-success inline-block" weight="duotone" />
				<span class="text-green-300">{change}</span>
			{:else}
				<MinusIcon class="text-secondary-500 inline-block" />
				<span class="text-secondary-500">0</span>
			{/if}
		</span>
	{/if}
{/snippet}

{#snippet rowExpand(row: MatchListRow)}
	{#if expandContent}
		{@render expandContent({ row })}
	{:else}
		<LiveLobbyPlayers
			players={row.players}
			{meSteamIds}
			{resolveFactionFlag}
			{playerHref}
			{playerLabel}
			showStats={hasLiveLobbyStats(row.players)}
			{alliesLabel}
			{axisLabel}
			{eloLabel}
			{levelLabel}
			{posLabel}
			{winsLabel}
			{lossesLabel}
			{streakLabel}
		/>
	{/if}
{/snippet}

{#snippet desktopCell(column: MatchListColumnId, row: MatchListRow, expanded: boolean)}
	{#if column === 'map'}
		<td class="h-11 w-px overflow-clip py-0 pr-0 pl-4">
			<MapImage
				small
				flush
				map={row.map}
				{resolveMapSrc}
				{resolveFallbackSrc}
				alt={formatMapName(row.map)}
			/>
		</td>
	{:else if column === 'name'}
		<td class="w-full truncate py-0 pr-4 pl-2 font-medium text-white">{formatMapName(row.map)}</td>
	{:else if column === 'type'}
		<td class="text-secondary-400 h-11 truncate px-4 py-0 whitespace-nowrap">{row.modeLabel ?? ''}</td>
	{:else if column === 'allies'}
		<td class="px-2 py-0 whitespace-nowrap">
			{@render factionFlags(
				teamPlayers(row.players, 'allies'),
				row.alliesOutcome,
				row.isRanked !== false,
				row.modeLabel
			)}
		</td>
	{:else if column === 'axis'}
		<td class="px-2 py-0 whitespace-nowrap">
			{@render factionFlags(
				teamPlayers(row.players, 'axis'),
				row.axisOutcome,
				row.isRanked !== false,
				row.modeLabel
			)}
		</td>
	{:else if column === 'host'}
		<td class="text-secondary-400 h-11 truncate px-4 py-0 whitespace-nowrap">
			{row.hostName || unknownHostLabel}
		</td>
	{:else if column === 'started'}
		<td class="text-secondary-500 h-11 truncate px-4 py-0 text-xs whitespace-nowrap tabular-nums">
			{formatStarted(row.createdAt)}
		</td>
	{:else if column === 'date'}
		<td class="text-secondary-400 truncate px-4 text-sm whitespace-nowrap">
			{(formatDate ?? formatStarted)(row.createdAt)}
		</td>
	{:else if column === 'duration'}
		<td class="text-secondary-400 truncate px-4 text-sm whitespace-nowrap">
			{formatDuration(row.durationSeconds)}
		</td>
	{:else if column === 'rating'}
		<td class="px-4 whitespace-nowrap">{@render ratingCell(row)}</td>
	{:else if column === 'actions'}
		<td class="px-4 whitespace-nowrap">
			{#if detailsHref}
				{@const detailUrl = detailsHref(row)}
				{#if detailUrl}
					<Button href={detailUrl} size="sm" variant="secondary" class="h-7 px-2.5 text-xs">
						{detailsLabel}
					</Button>
				{/if}
			{/if}
		</td>
	{:else if column === 'expand'}
		<td class="px-4 whitespace-nowrap">
			<CaretDownIcon class={cn('size-4 transition-transform', expanded && 'rotate-180')} />
		</td>
	{/if}
{/snippet}

{#snippet factionFlagsSkeleton()}
	<span class="flex h-11 items-center gap-0">
		<Skeleton class="size-11 shrink-0 rounded-none" />
		<Skeleton class="size-11 shrink-0 rounded-none" />
	</span>
{/snippet}

{#snippet desktopSkeletonCell(column: MatchListColumnId)}
	{#if column === 'map'}
		<td class="h-11 w-px overflow-clip py-0 pr-0 pl-4">
			<div class="flex h-11 items-center">
				<Skeleton class="size-11 shrink-0 rounded-none" />
			</div>
		</td>
	{:else if column === 'name'}
		<td class="w-full truncate py-0 pr-4 pl-2">
			<div class="flex h-11 items-center">
				<Skeleton class="h-4 w-36" />
			</div>
		</td>
	{:else if column === 'type'}
		<td class="px-4 py-0 whitespace-nowrap">
			<div class="flex h-11 items-center">
				<Skeleton class="h-4 w-16" />
			</div>
		</td>
	{:else if column === 'allies'}
		<td class="px-2 py-0 whitespace-nowrap">
			<div class="flex h-11 items-center">
				{@render factionFlagsSkeleton()}
			</div>
		</td>
	{:else if column === 'axis'}
		<td class="px-2 py-0 whitespace-nowrap">
			<div class="flex h-11 items-center">
				{@render factionFlagsSkeleton()}
			</div>
		</td>
	{:else if column === 'host' || column === 'started' || column === 'rating'}
		<td class="px-4 py-0 whitespace-nowrap">
			<div class="flex h-11 items-center">
				<Skeleton class="h-4 w-20" />
			</div>
		</td>
	{:else if column === 'date'}
		<td class="px-4 py-0 whitespace-nowrap">
			<div class="flex h-11 items-center">
				<Skeleton class="h-4 w-28" />
			</div>
		</td>
	{:else if column === 'duration'}
		<td class="px-4 py-0 whitespace-nowrap">
			<div class="flex h-11 items-center">
				<Skeleton class="h-4 w-14" />
			</div>
		</td>
	{:else if column === 'actions'}
		<td class="px-4 py-0 whitespace-nowrap">
			<div class="flex h-11 items-center">
				<Skeleton class="h-7 w-16" />
			</div>
		</td>
	{:else if column === 'expand'}
		<td class="px-4 py-0 whitespace-nowrap">
			<div class="flex h-11 items-center">
				<Skeleton class="size-4" />
			</div>
		</td>
	{/if}
{/snippet}

<div class={className}>
	{#if loading}
		<div class="hidden md:block">
			<table class="w-full table-auto">
				<thead class="border-secondary-800 border-b">
					<tr class="{tableHeadRow} text-left">
						{#each columns as column (column)}
							<th
								class={cn(
									'py-3',
									column === 'map'
										? 'w-px px-0 pl-4'
										: column === 'name'
											? 'w-full pr-4 pl-2'
									: column === 'allies' || column === 'axis'
										? 'px-2 py-3 whitespace-nowrap'
										: 'px-4 whitespace-nowrap'
								)}
							>
								{headerById[column]}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each Array(3) as _, index (index)}
						<tr class="border-secondary-800 h-11 border-b">
							{#each columns as column (column)}
								{@render desktopSkeletonCell(column)}
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="md:hidden">
			{#each Array(3) as _, index (index)}
				<div class="border-secondary-800 border-b px-4 py-3">
					<div class="flex gap-3">
						<Skeleton class="size-11 shrink-0 rounded-none" />
						<div class="min-w-0 flex-1">
							<div class="space-y-2">
								<Skeleton class="h-4 w-36" />
								<Skeleton class="h-3 w-16" />
							</div>
							<div class="mt-2.5 flex items-center gap-3">
								{@render factionFlagsSkeleton()}
								{@render factionFlagsSkeleton()}
							</div>
							<div class="mt-2 flex items-center gap-3">
								<Skeleton class="h-3 w-20" />
								<Skeleton class="h-3 w-14" />
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if rows.length === 0}
		<p class="text-secondary-400 px-4 py-3 text-sm">{emptyMessage}</p>
	{:else}
		<div class="hidden overflow-x-auto md:block">
			<table class="w-full table-auto border-collapse text-sm">
				<thead class="border-secondary-800 border-b">
					<tr class="{tableHeadRow} text-left">
						{#each columns as column (column)}
							<th
								class={cn(
									'py-3',
									column === 'map'
										? 'w-px px-0 pl-4'
										: column === 'name'
											? 'w-full pr-4 pl-2'
									: column === 'allies' || column === 'axis'
										? 'px-2 py-3 whitespace-nowrap'
										: 'px-4 whitespace-nowrap'
								)}
							>
								{headerById[column]}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.id)}
						{@const expanded = canExpand && expandedId === row.id}
						<tr
							class={cn(
								interactive,
								'border-secondary-800 text-secondary-300 h-11 border-b transition-colors',
								'hover:bg-secondary-950/60 hover:text-primary',
								expanded && 'bg-secondary-950/60 text-primary',
								!canExpand && 'cursor-default'
							)}
							aria-expanded={canExpand ? expanded : undefined}
							onclick={canExpand ? (event) => handleRowClick(event, row.id) : undefined}
						>
							{#each columns as column (column)}
								{@render desktopCell(column, row, expanded)}
							{/each}
						</tr>
						{#if expanded}
							<tr>
								<td colspan={columnCount} class="p-0">
									{@render rowExpand(row)}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
		<div class="md:hidden">
			{#each rows as row (row.id)}
				{@const expanded = canExpand && expandedId === row.id}
				<!-- role+tabindex are set together when expandable; analyzer cannot see that -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					class={cn(
						interactive,
						'border-secondary-800 text-secondary-300 border-b transition-colors',
						'hover:bg-secondary-950/60 hover:text-primary',
						expanded && 'bg-secondary-950/60 text-primary',
						!canExpand && 'cursor-default'
					)}
					role={canExpand ? 'button' : undefined}
					tabindex={canExpand ? 0 : undefined}
					aria-expanded={canExpand ? expanded : undefined}
					onclick={canExpand ? (event) => handleRowClick(event, row.id) : undefined}
					onkeydown={canExpand ? (event) => handleRowKeydown(event, row.id) : undefined}
				>
					<div class="flex gap-3 px-4 py-3">
						{#if columns.includes('map')}
							<MapImage
								small
								map={row.map}
								{resolveMapSrc}
								{resolveFallbackSrc}
								alt={formatMapName(row.map)}
							/>
						{/if}
						<div class="min-w-0 flex-1">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="truncate font-medium text-white">{formatMapName(row.map)}</p>
									{#if columns.includes('type')}
										<p class="text-secondary-400 truncate text-sm">{row.modeLabel ?? ''}</p>
									{/if}
								</div>
								<div class="flex shrink-0 items-center gap-2">
									{#if showActions && detailsHref}
										{@const detailUrl = detailsHref(row)}
										{#if detailUrl}
											<Button
												href={detailUrl}
												size="sm"
												variant="secondary"
												class="h-7 px-2.5 text-xs"
											>
												{detailsLabel}
											</Button>
										{/if}
									{/if}
									{#if canExpand}
										<CaretDownIcon
											class={cn('size-4 transition-transform', expanded && 'rotate-180')}
										/>
									{/if}
								</div>
							</div>
							{#if columns.includes('allies') || columns.includes('axis')}
								<div class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
									{#if columns.includes('allies')}
										<div class="flex min-w-0 items-center gap-1.5">
											<span class="text-secondary-500 text-xs">{alliesLabel}</span>
											{@render factionFlags(
												teamPlayers(row.players, 'allies'),
												row.alliesOutcome,
												row.isRanked !== false,
												row.modeLabel
											)}
										</div>
									{/if}
									{#if columns.includes('axis')}
										<div class="flex min-w-0 items-center gap-1.5">
											<span class="text-secondary-500 text-xs">{axisLabel}</span>
											{@render factionFlags(
												teamPlayers(row.players, 'axis'),
												row.axisOutcome,
												row.isRanked !== false,
												row.modeLabel
											)}
										</div>
									{/if}
								</div>
							{/if}
							<div
								class="text-secondary-400 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
							>
								{#if columns.includes('host')}
									<span class="truncate">{row.hostName || unknownHostLabel}</span>
								{/if}
								{#if columns.includes('started')}
									<span class="text-secondary-500 tabular-nums">{formatStarted(row.createdAt)}</span
									>
								{/if}
								{#if columns.includes('date')}
									<span class="text-secondary-500 tabular-nums"
										>{(formatDate ?? formatStarted)(row.createdAt)}</span
									>
								{/if}
								{#if columns.includes('duration')}
									<span class="text-secondary-500 tabular-nums"
										>{formatDuration(row.durationSeconds)}</span
									>
								{/if}
								{#if columns.includes('rating')}
									{@render ratingCell(row)}
								{/if}
							</div>
						</div>
					</div>
					{#if expanded}
						{@render rowExpand(row)}
					{/if}
				</div>
			{/each}
		</div>
	{/if}
	{#if footer}
		{@render footer()}
	{/if}
</div>
