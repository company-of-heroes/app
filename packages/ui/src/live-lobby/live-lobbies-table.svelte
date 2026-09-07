<script lang="ts">
	import MapImage from '../ui/map-image.svelte';
	import { Button } from '../ui/button';
	import { Skeleton } from '../ui/skeleton';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, tableHeadRow } from '@company-of-heroes/ui/variants';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import LiveLobbyPlayers from './live-lobby-players.svelte';
	import { hasLiveLobbyStats } from './stats';
	import {
		defaultLiveLobbyPlayerLabel,
		playerRowKey,
		teamPlayers,
		type LiveLobby,
		type LiveLobbyPlayer
	} from './types';

	type Props = {
		lobbies: LiveLobby[];
		loading?: boolean;
		meSteamIds?: string[];
		resolveMapSrc: (map: string | undefined) => string | undefined;
		resolveFallbackSrc?: () => string | undefined;
		resolveFactionFlag: (race: number) => string;
		formatMapName: (map: string) => string;
		formatStarted: (createdAt: string) => string;
		playerHref: (player: LiveLobbyPlayer) => string | null;
		playerLabel?: (player: LiveLobbyPlayer) => string;
		detailsHref?: (lobby: LiveLobby) => string | null;
		emptyMessage?: string;
		mapLabel?: string;
		nameLabel?: string;
		typeLabel?: string;
		alliesLabel?: string;
		axisLabel?: string;
		hostLabel?: string;
		startedLabel?: string;
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
		lobbies,
		loading = false,
		meSteamIds = [],
		resolveMapSrc,
		resolveFallbackSrc,
		resolveFactionFlag,
		formatMapName,
		formatStarted,
		playerHref,
		playerLabel = defaultLiveLobbyPlayerLabel,
		detailsHref,
		emptyMessage = 'No community members are in a match right now.',
		mapLabel = 'Map',
		nameLabel = 'Name',
		typeLabel = 'Type',
		alliesLabel = 'Allies',
		axisLabel = 'Axis',
		hostLabel = 'Host',
		startedLabel = 'Started at',
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
	const columnCount = $derived(detailsHref ? 9 : 8);

	function toggleExpanded(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	function handleRowClick(event: MouseEvent, id: string) {
		const target = event.target as HTMLElement;
		if (target.closest('a, button')) {
			return;
		}

		toggleExpanded(id);
	}
</script>

{#snippet factionFlags(players: LiveLobbyPlayer[])}
	<span class="flex items-center gap-1.5">
		{#each players as player, rowIndex (playerRowKey(player, rowIndex))}
			{@const href = playerHref(player)}
			{@const label = playerLabel(player)}
			{@const isMe = Boolean(player.steamId && meSteamIds.includes(player.steamId))}
			{#if href}
				<a {href} title={label} class={cn(interactive, 'shrink-0 rounded-full')}>
					<img
						src={resolveFactionFlag(player.race)}
						alt={label}
						class={cn(
							'!size-5 shrink-0 rounded-full object-cover ring-secondary-800 ring-4',
							isMe && 'ring-primary'
						)}
					/>
				</a>
			{:else}
				<img
					src={resolveFactionFlag(player.race)}
					alt={label}
					title={label}
					class={cn(
						'!size-5 shrink-0 rounded-full object-cover ring-secondary-800 ring-4 opacity-70',
						isMe && 'ring-primary'
					)}
				/>
			{/if}
		{/each}
	</span>
{/snippet}

{#if loading}
	<table class="w-full table-fixed">
		<thead class="border-secondary-800 border-b">
			<tr class="{tableHeadRow} text-left">
				<th class="px-4 py-3">{mapLabel}</th>
				<th class="px-4 py-3">{nameLabel}</th>
				<th class="px-4 py-3">{typeLabel}</th>
				<th class="px-4 py-3">{alliesLabel}</th>
				<th class="px-4 py-3">{axisLabel}</th>
				<th class="px-4 py-3">{hostLabel}</th>
				<th class="px-4 py-3 whitespace-nowrap">{startedLabel}</th>
				{#if detailsHref}
					<th class="px-4 py-3"></th>
				{/if}
				<th class="px-4 py-3"></th>
			</tr>
		</thead>
		<tbody>
			{#each Array(3) as _, index (index)}
				<tr class="border-secondary-800 h-11 border-b">
					{#each Array(columnCount) as _, cellIndex (cellIndex)}
						<td class="px-4">
							<Skeleton class="h-4 w-full rounded-none" />
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
{:else if lobbies.length === 0}
	<p class="text-secondary-400 px-4 py-3 text-sm">{emptyMessage}</p>
{:else}
	<div class="overflow-x-auto">
		<table class="w-full table-fixed border-collapse text-sm">
			<thead class="border-secondary-800 border-b">
				<tr class="{tableHeadRow} text-left">
					<th class="w-2/24 px-4 py-3">{mapLabel}</th>
					<th class="w-4/24 px-4 py-3">{nameLabel}</th>
					<th class="w-3/24 px-4 py-3">{typeLabel}</th>
					<th class="w-3/24 px-4 py-3">{alliesLabel}</th>
					<th class="w-3/24 px-4 py-3">{axisLabel}</th>
					<th class="w-3/24 px-4 py-3">{hostLabel}</th>
					<th class="w-3/24 px-4 py-3 whitespace-nowrap">{startedLabel}</th>
					{#if detailsHref}
						<th class="w-2/24 px-4 py-3"></th>
					{/if}
					<th class="w-1/24 px-4 py-3"></th>
				</tr>
			</thead>
			<tbody>
				{#each lobbies as lobby (lobby.id)}
					{@const expanded = expandedId === lobby.id}
					<tr
						class={cn(
							interactive,
							'border-secondary-800 text-secondary-300 h-11 border-b transition-colors',
							'hover:bg-secondary-950/60 hover:text-primary',
							expanded && 'bg-secondary-950/60 text-primary'
						)}
						aria-expanded={expanded}
						onclick={(event) => handleRowClick(event, lobby.id)}
					>
						<td class="h-11 overflow-clip py-0 pr-0 pl-4">
							<MapImage
								small
								flush
								map={lobby.map}
								{resolveMapSrc}
								{resolveFallbackSrc}
								alt={formatMapName(lobby.map)}
							/>
						</td>
						<td class="truncate px-4 font-medium text-white">{formatMapName(lobby.map)}</td>
						<td class="text-secondary-400 truncate px-4">{lobby.modeLabel}</td>
						<td class="overflow-hidden px-4">
							{@render factionFlags(teamPlayers(lobby.players, 'allies'))}
						</td>
						<td class="overflow-hidden px-4">
							{@render factionFlags(teamPlayers(lobby.players, 'axis'))}
						</td>
						<td class="text-secondary-400 truncate px-4">{lobby.hostName || unknownHostLabel}</td>
						<td class="text-secondary-500 truncate px-4 text-xs tabular-nums">
							{formatStarted(lobby.createdAt)}
						</td>
						{#if detailsHref}
							{@const detailUrl = detailsHref(lobby)}
							<td class="px-4">
								{#if detailUrl}
									<Button href={detailUrl} size="sm" variant="secondary" class="h-7 px-2.5 text-xs">
										{detailsLabel}
									</Button>
								{/if}
							</td>
						{/if}
						<td class="px-4">
							<CaretDownIcon class={cn('size-4 transition-transform', expanded && 'rotate-180')} />
						</td>
					</tr>
					{#if expanded}
						<tr>
							<td colspan={columnCount} class="p-0">
								<LiveLobbyPlayers
									players={lobby.players}
									{meSteamIds}
									{resolveFactionFlag}
									{playerHref}
									{playerLabel}
									showStats={hasLiveLobbyStats(lobby.players)}
									{alliesLabel}
									{axisLabel}
									{eloLabel}
									{levelLabel}
									{posLabel}
									{winsLabel}
									{lossesLabel}
									{streakLabel}
								/>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{/if}
