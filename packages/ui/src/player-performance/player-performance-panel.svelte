<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import MapImage from '../ui/map-image.svelte';
	import type { PlayerEloMap } from '../format/types';
	import {
		getEloColor,
		getEloTextShadow,
		getModeLabel,
		getRaceLabel,
		getRatioColor,
		isEliteElo,
		normalizeMapName,
		winrate
	} from '../format/player-format';
	import { statLosses, statWins, tableHeadRow } from '@company-of-heroes/ui/variants';
	import ChartLineIcon from 'phosphor-svelte/lib/ChartLineIcon';
	import MapTrifoldIcon from 'phosphor-svelte/lib/MapTrifoldIcon';
	import FlagIcon from 'phosphor-svelte/lib/FlagIcon';
	import UsersThreeIcon from 'phosphor-svelte/lib/UsersThreeIcon';
	import PlayerPerformanceSection from './player-performance-section.svelte';

	export type PlayerPerformanceStats = {
		matchCount: number;
		byMap: Array<{ map: string; wins: number; losses: number }>;
		byFaction: Array<{ raceId: number; wins: number; losses: number }>;
		byMode: Array<{ matchtypeId: number; wins: number; losses: number }>;
	};

	type EloRow = {
		matchtypeId: number;
		raceId: number;
		rating: number;
	};

	type Props = {
		performance: PlayerPerformanceStats;
		elo?: PlayerEloMap;
		resolveFactionFlag: (raceId: number) => string;
		resolveMapSrc: (map: string | undefined) => string | undefined;
		resolveFallbackSrc?: () => string | undefined;
		formatMapName?: (map: string, includePlayerCount?: boolean) => string;
		emptyPerformanceMessage?: string;
		emptyEloMessage?: string;
		eloHistoryTitle?: string;
		trackedLobbyRatingsLabel?: string;
		byMapTitle?: string;
		byFactionTitle?: string;
		byModeTitle?: string;
		mapsSummary?: string;
		factionsSummary?: string;
		modesSummary?: string;
		mapLabel?: string;
		gamesLabel?: string;
		winsLabel?: string;
		lossesLabel?: string;
		winrateLabel?: string;
		modeLabel?: string;
		factionLabel?: string;
		eloLabel?: string;
	};

	let {
		performance: stats,
		elo,
		resolveFactionFlag,
		resolveMapSrc,
		resolveFallbackSrc,
		formatMapName = normalizeMapName,
		emptyPerformanceMessage = 'No tracked community matches for this player.',
		emptyEloMessage = 'No tracked match ratings yet. Play with the companion running so lobby results can build this history.',
		eloHistoryTitle = 'ELO history',
		trackedLobbyRatingsLabel = 'Tracked lobby ratings',
		byMapTitle = 'By map',
		byFactionTitle = 'By faction',
		byModeTitle = 'By mode',
		mapsSummary = '{maps} maps · {games} games',
		factionsSummary = '{factions} factions · {games} games',
		modesSummary = '{modes} game modes · {games} games',
		mapLabel = 'Map',
		gamesLabel = 'Games',
		winsLabel = 'Wins',
		lossesLabel = 'Losses',
		winrateLabel = 'Winrate',
		modeLabel = 'Mode',
		factionLabel = 'Faction',
		eloLabel = 'ELO'
	}: Props = $props();

	const byMode = $derived(stats.byMode.filter((mode) => mode.matchtypeId !== 14));
	const headerRow = tableHeadRow;

	let eloExpanded = $state(false);
	let mapsExpanded = $state(false);
	let factionExpanded = $state(false);
	let modeExpanded = $state(false);

	const mapGames = $derived(stats.byMap.reduce((total, row) => total + row.wins + row.losses, 0));
	const factionGames = $derived(
		stats.byFaction.reduce((total, row) => total + row.wins + row.losses, 0)
	);
	const modeGames = $derived(byMode.reduce((total, row) => total + row.wins + row.losses, 0));

	const eloRows = $derived(flattenElo(elo));

	function flattenElo(eloMap: PlayerEloMap | undefined): EloRow[] {
		const rows: EloRow[] = [];
		for (const [matchType, races] of Object.entries(eloMap ?? {})) {
			const matchtypeId = Number(matchType);
			if (!Number.isInteger(matchtypeId) || matchtypeId === 14) continue;
			for (const [race, slot] of Object.entries(races ?? {})) {
				if (typeof slot?.rating !== 'number' || slot.rating < 1) continue;
				rows.push({ matchtypeId, raceId: Number(race), rating: slot.rating });
			}
		}
		return rows.sort((a, b) => a.matchtypeId - b.matchtypeId || a.raceId - b.raceId);
	}

	function fill(template: string, values: Record<string, string | number>) {
		return Object.entries(values).reduce(
			(text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
			template
		);
	}

	function mapCount(mapName: string): string | null {
		return mapName.match(/^(\d+)[pP][ _]/)?.[1] ?? null;
	}
</script>

{#snippet statCells(row: { wins: number; losses: number })}
	<td class="text-secondary-300 w-[3.25rem] px-2 py-1.5 text-center font-medium tabular-nums">
		{row.wins + row.losses}
	</td>
	<td class="{statWins} w-[4.5rem] px-2 py-1.5 text-center font-medium">{row.wins}</td>
	<td class="{statLosses} w-[4.75rem] px-2 py-1.5 text-center font-medium">{row.losses}</td>
	<td
		class="w-[4.5rem] px-2 py-1.5 text-center font-medium tabular-nums"
		style:color={getRatioColor(row.wins, row.losses)}
	>
		{winrate(row.wins, row.losses)}
	</td>
{/snippet}

{#snippet statMeta(row: { wins: number; losses: number })}
	<div class="text-secondary-400 mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
		<span>
			{gamesLabel}
			<span class="text-secondary-300 font-medium tabular-nums">{row.wins + row.losses}</span>
		</span>
		<span>
			{winsLabel} <span class={cn('font-medium', statWins)}>{row.wins}</span>
		</span>
		<span>
			{lossesLabel} <span class={cn('font-medium', statLosses)}>{row.losses}</span>
		</span>
		<span>
			{winrateLabel}
			<span class="font-medium tabular-nums" style:color={getRatioColor(row.wins, row.losses)}>
				{winrate(row.wins, row.losses)}
			</span>
		</span>
	</div>
{/snippet}

<PlayerPerformanceSection
	title={eloHistoryTitle}
	summary={trackedLobbyRatingsLabel}
	icon={ChartLineIcon}
	bind:expanded={eloExpanded}
>
	{#if eloRows.length === 0}
		<p class="text-secondary-400 px-4 py-6 text-sm">{emptyEloMessage}</p>
	{:else}
		<div class="hidden md:block overflow-x-auto">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class={headerRow}>
						<th class="px-4 py-2 text-left">{modeLabel}</th>
						<th class="px-4 py-2 text-left">{factionLabel}</th>
						<th class="w-[6.5rem] px-2 py-2 text-center">{eloLabel}</th>
					</tr>
				</thead>
				<tbody>
					{#each eloRows as row (`${row.matchtypeId}-${row.raceId}`)}
						<tr class="border-secondary-800 border-b">
							<td class="px-4 py-1.5 text-white">{getModeLabel(row.matchtypeId)}</td>
							<td class="px-4 py-1.5">
								<div class="flex min-w-0 items-center gap-2">
									<img
										src={resolveFactionFlag(row.raceId)}
										alt=""
										class="w-6 shrink-0 ring-2 ring-black"
									/>
									<span class="min-w-0 truncate">{getRaceLabel(row.raceId)}</span>
								</div>
							</td>
							<td
								class={cn(
									'px-2 py-1.5 text-center tabular-nums',
									isEliteElo(row.rating) && 'font-bold tracking-wide'
								)}
								style:color={getEloColor(row.rating)}
								style:text-shadow={getEloTextShadow(row.rating)}
							>
								{row.rating}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="divide-secondary-800 divide-y md:hidden">
			{#each eloRows as row (`${row.matchtypeId}-${row.raceId}`)}
				<div class="px-4 py-3 text-white">
					<div class="flex items-center gap-2">
						<span class="min-w-0 flex-1 truncate font-medium">{getModeLabel(row.matchtypeId)}</span>
						<span
							class={cn(
								'shrink-0 tabular-nums',
								isEliteElo(row.rating) && 'font-bold tracking-wide'
							)}
							style:color={getEloColor(row.rating)}
							style:text-shadow={getEloTextShadow(row.rating)}
						>
							{row.rating}
						</span>
					</div>
					<div class="mt-2 flex min-w-0 items-center gap-2 text-sm">
						<img
							src={resolveFactionFlag(row.raceId)}
							alt=""
							class="w-6 shrink-0 ring-2 ring-black"
						/>
						<span class="text-secondary-300 min-w-0 truncate">{getRaceLabel(row.raceId)}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</PlayerPerformanceSection>

{#if stats.matchCount === 0}
	<p class="text-secondary-400 px-4 py-3 text-sm">{emptyPerformanceMessage}</p>
{:else}
	<PlayerPerformanceSection
		title={byMapTitle}
		summary={fill(mapsSummary, { maps: stats.byMap.length, games: mapGames })}
		icon={MapTrifoldIcon}
		bind:expanded={mapsExpanded}
	>
		<div class="hidden md:block overflow-x-auto">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class={headerRow}>
						<th class="px-4 py-2 text-left">{mapLabel}</th>
						<th class="w-[3.25rem] px-2 py-2 text-center">{gamesLabel}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{winsLabel}</th>
						<th class="w-[4.75rem] px-2 py-2 text-center">{lossesLabel}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{winrateLabel}</th>
					</tr>
				</thead>
				<tbody>
					{#each stats.byMap as row (row.map)}
						{@const players = mapCount(row.map)}
						<tr class="border-secondary-800 border-b">
							<td class="px-4 py-1.5">
								<div class="flex min-w-0 items-center gap-3">
									<MapImage
										map={row.map}
										{resolveMapSrc}
										{resolveFallbackSrc}
										alt={formatMapName(row.map)}
									/>
									<span class="min-w-0 truncate text-white">
										{formatMapName(row.map, false)}
										{#if players}
											<span class="text-secondary-400">({players})</span>
										{/if}
									</span>
								</div>
							</td>
							{@render statCells(row)}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="divide-secondary-800 divide-y md:hidden">
			{#each stats.byMap as row (row.map)}
				{@const players = mapCount(row.map)}
				<div class="px-4 py-3 text-white">
					<div class="flex min-w-0 items-center gap-3">
						<MapImage
							map={row.map}
							{resolveMapSrc}
							{resolveFallbackSrc}
							alt={formatMapName(row.map)}
						/>
						<span class="min-w-0 truncate font-medium">
							{formatMapName(row.map, false)}
							{#if players}
								<span class="text-secondary-400">({players})</span>
							{/if}
						</span>
					</div>
					{@render statMeta(row)}
				</div>
			{/each}
		</div>
	</PlayerPerformanceSection>

	<PlayerPerformanceSection
		title={byFactionTitle}
		summary={fill(factionsSummary, { factions: stats.byFaction.length, games: factionGames })}
		icon={FlagIcon}
		bind:expanded={factionExpanded}
	>
		<div class="hidden md:block overflow-x-auto">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class={headerRow}>
						<th class="px-4 py-2 text-left">{factionLabel}</th>
						<th class="w-[3.25rem] px-2 py-2 text-center">{gamesLabel}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{winsLabel}</th>
						<th class="w-[4.75rem] px-2 py-2 text-center">{lossesLabel}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{winrateLabel}</th>
					</tr>
				</thead>
				<tbody>
					{#each stats.byFaction as row (row.raceId)}
						<tr class="border-secondary-800 border-b">
							<td class="px-4 py-1.5">
								<div class="flex min-w-0 items-center gap-2">
									<img
										src={resolveFactionFlag(row.raceId)}
										alt=""
										class="w-6 shrink-0 ring-2 ring-black"
									/>
									<span class="min-w-0 truncate text-white">{getRaceLabel(row.raceId)}</span>
								</div>
							</td>
							{@render statCells(row)}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="divide-secondary-800 divide-y md:hidden">
			{#each stats.byFaction as row (row.raceId)}
				<div class="px-4 py-3 text-white">
					<div class="flex min-w-0 items-center gap-2">
						<img
							src={resolveFactionFlag(row.raceId)}
							alt=""
							class="w-6 shrink-0 ring-2 ring-black"
						/>
						<span class="min-w-0 truncate font-medium">{getRaceLabel(row.raceId)}</span>
					</div>
					{@render statMeta(row)}
				</div>
			{/each}
		</div>
	</PlayerPerformanceSection>

	<PlayerPerformanceSection
		title={byModeTitle}
		summary={fill(modesSummary, { modes: byMode.length, games: modeGames })}
		icon={UsersThreeIcon}
		bind:expanded={modeExpanded}
	>
		<div class="hidden md:block overflow-x-auto">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class={headerRow}>
						<th class="px-4 py-2 text-left">{modeLabel}</th>
						<th class="w-[3.25rem] px-2 py-2 text-center">{gamesLabel}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{winsLabel}</th>
						<th class="w-[4.75rem] px-2 py-2 text-center">{lossesLabel}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{winrateLabel}</th>
					</tr>
				</thead>
				<tbody>
					{#each byMode as row (row.matchtypeId)}
						<tr class="border-secondary-800 border-b">
							<td class="px-4 py-1.5 text-white">{getModeLabel(row.matchtypeId)}</td>
							{@render statCells(row)}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="divide-secondary-800 divide-y md:hidden">
			{#each byMode as row (row.matchtypeId)}
				<div class="px-4 py-3 text-white">
					<span class="font-medium">{getModeLabel(row.matchtypeId)}</span>
					{@render statMeta(row)}
				</div>
			{/each}
		</div>
	</PlayerPerformanceSection>
{/if}
