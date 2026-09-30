<script lang="ts">
	import { useHost } from '../host/host.context';
	import { useI18n } from '@company-of-heroes/i18n';
	import type { Snippet } from 'svelte';
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
	import { interactive, statLosses, statWins, tableHeadRow } from '@company-of-heroes/ui/variants';
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
		resolveFallbackSrc?: () => string | undefined;
		/** Overrides the default empty text (e.g. "play with the companion" on your own profile). */
		emptyPerformanceMessage?: string;
		/** Overrides the collapsed ELO section summary. */
		trackedLobbyRatingsLabel?: string;
		eloContent?: Snippet;
		mapRowDetail?: Snippet<[row: { map: string; wins: number; losses: number }]>;
		factionRowDetail?: Snippet<[row: { raceId: number; wins: number; losses: number }]>;
		modeRowDetail?: Snippet<[row: { matchtypeId: number; wins: number; losses: number }]>;
		includeSkirmish?: boolean;
		eloExpanded?: boolean;
	};

	const { t } = useI18n();
	const host = useHost();

	let {
		performance: stats,
		elo,
		resolveFallbackSrc,
		emptyPerformanceMessage,
		trackedLobbyRatingsLabel,
		eloContent,
		mapRowDetail,
		factionRowDetail,
		modeRowDetail,
		includeSkirmish = false,
		eloExpanded = $bindable(false)
	}: Props = $props();

	const byMode = $derived(
		includeSkirmish ? stats.byMode : stats.byMode.filter((mode) => mode.matchtypeId !== 14)
	);
	const headerRow = tableHeadRow;
	let mapsExpanded = $state(false);
	let factionExpanded = $state(false);
	let modeExpanded = $state(false);
	let expandedMap = $state<string | null>(null);
	let expandedFaction = $state<number | null>(null);
	let expandedMode = $state<number | null>(null);

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
			if (!Number.isInteger(matchtypeId) || matchtypeId === 14) {
				continue;
			}

			for (const [race, slot] of Object.entries(races ?? {})) {
				if (typeof slot?.rating !== 'number' || slot.rating < 1) {
					continue;
				}

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

	function toggleMapRow(row: { map: string }) {
		expandedMap = expandedMap === row.map ? null : row.map;
	}

	function toggleFactionRow(row: { raceId: number }) {
		expandedFaction = expandedFaction === row.raceId ? null : row.raceId;
	}

	function toggleModeRow(row: { matchtypeId: number }) {
		expandedMode = expandedMode === row.matchtypeId ? null : row.matchtypeId;
	}

	const statColumnCount = 5;
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
			{t('Games')}
			<span class="text-secondary-300 font-medium tabular-nums">{row.wins + row.losses}</span>
		</span>
		<span>
			{t('Wins')} <span class={cn('font-medium', statWins)}>{row.wins}</span>
		</span>
		<span>
			{t('Losses')} <span class={cn('font-medium', statLosses)}>{row.losses}</span>
		</span>
		<span>
			{t('Winrate')}
			<span class="font-medium tabular-nums" style:color={getRatioColor(row.wins, row.losses)}>
				{winrate(row.wins, row.losses)}
			</span>
		</span>
	</div>
{/snippet}

{#snippet mapMobileCard(row: { map: string; wins: number; losses: number }, players: string | null)}
	<div class="flex min-w-0 items-center gap-3">
		<MapImage
			map={row.map}
			resolveMapSrc={host.resolve.mapSrc}
			{resolveFallbackSrc}
			alt={normalizeMapName(row.map)}
		/>
		<span class="min-w-0 truncate font-medium">
			{normalizeMapName(row.map, false)}
			{#if players}
				<span class="text-secondary-400">({players})</span>
			{/if}
		</span>
	</div>
	{@render statMeta(row)}
{/snippet}

{#snippet factionMobileCard(row: { raceId: number; wins: number; losses: number })}
	<div class="flex min-w-0 items-center gap-2">
		<img
			src={host.resolve.factionFlagByRace(row.raceId)}
			alt=""
			class="w-6 shrink-0 ring-2 ring-black"
		/>
		<span class="min-w-0 truncate font-medium">{getRaceLabel(row.raceId)}</span>
	</div>
	{@render statMeta(row)}
{/snippet}

{#snippet modeMobileCard(row: { matchtypeId: number; wins: number; losses: number })}
	<span class="font-medium">{getModeLabel(row.matchtypeId)}</span>
	{@render statMeta(row)}
{/snippet}

<PlayerPerformanceSection
	title={t('ELO history')}
	summary={trackedLobbyRatingsLabel ?? t('Tracked lobby ratings')}
	icon={ChartLineIcon}
	bind:expanded={eloExpanded}
>
	{#if eloContent}
		{@render eloContent()}
	{:else if eloRows.length === 0}
		<p class="text-secondary-400 px-4 py-6 text-sm">
			{t(
				'No tracked match ratings yet. Play with the companion running so lobby results can build this history.'
			)}
		</p>
	{:else}
		<div class="hidden overflow-x-auto md:block">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class={headerRow}>
						<th class="px-4 py-2 text-left">{t('Mode')}</th>
						<th class="px-4 py-2 text-left">{t('Faction')}</th>
						<th class="w-[6.5rem] px-2 py-2 text-center">{t('ELO')}</th>
					</tr>
				</thead>
				<tbody>
					{#each eloRows as row (`${row.matchtypeId}-${row.raceId}`)}
						<tr class="border-secondary-800 border-b">
							<td class="px-4 py-1.5 text-white">{getModeLabel(row.matchtypeId)}</td>
							<td class="px-4 py-1.5">
								<div class="flex min-w-0 items-center gap-2">
									<img
										src={host.resolve.factionFlagByRace(row.raceId)}
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
							src={host.resolve.factionFlagByRace(row.raceId)}
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
	<p class="text-secondary-400 px-4 py-3 text-sm">
		{emptyPerformanceMessage ?? t('No tracked community matches for this player.')}
	</p>
{:else}
	<PlayerPerformanceSection
		title={t('By map')}
		summary={fill(t('{maps} maps · {games} games'), { maps: stats.byMap.length, games: mapGames })}
		icon={MapTrifoldIcon}
		bind:expanded={mapsExpanded}
	>
		<div class="hidden overflow-x-auto md:block">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class={headerRow}>
						<th class="px-4 py-2 text-left">{t('Map')}</th>
						<th class="w-[3.25rem] px-2 py-2 text-center">{t('Games')}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{t('Wins')}</th>
						<th class="w-[4.75rem] px-2 py-2 text-center">{t('Losses')}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{t('Winrate')}</th>
					</tr>
				</thead>
				<tbody>
					{#each stats.byMap as row (row.map)}
						{@const players = mapCount(row.map)}
						{@const mapExpanded = mapRowDetail !== undefined && expandedMap === row.map}
						<tr
							class={cn('border-secondary-800 border-b', mapRowDetail && interactive)}
							onclick={mapRowDetail ? () => toggleMapRow(row) : undefined}
						>
							<td class="px-4 py-1.5">
								<div class="flex min-w-0 items-center gap-3">
									<MapImage
										map={row.map}
										resolveMapSrc={host.resolve.mapSrc}
										{resolveFallbackSrc}
										alt={normalizeMapName(row.map)}
									/>
									<span class="min-w-0 truncate text-white">
										{normalizeMapName(row.map, false)}
										{#if players}
											<span class="text-secondary-400">({players})</span>
										{/if}
									</span>
								</div>
							</td>
							{@render statCells(row)}
						</tr>
						{#if mapExpanded && mapRowDetail}
							<tr>
								<td colspan={statColumnCount} class="border-secondary-800 border-b p-0">
									{@render mapRowDetail(row)}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<div class="divide-secondary-800 divide-y md:hidden">
			{#each stats.byMap as row (row.map)}
				{@const players = mapCount(row.map)}
				{@const mapExpanded = mapRowDetail !== undefined && expandedMap === row.map}
				{#if mapRowDetail}
					<button
						type="button"
						class={cn('block w-full px-4 py-3 text-left text-white', interactive)}
						onclick={() => toggleMapRow(row)}
					>
						{@render mapMobileCard(row, players)}
						{#if mapExpanded}
							<div class="border-secondary-800 mt-3 border-t pt-3">
								{@render mapRowDetail(row)}
							</div>
						{/if}
					</button>
				{:else}
					<div class="px-4 py-3 text-white">
						{@render mapMobileCard(row, players)}
					</div>
				{/if}
			{/each}
		</div>
	</PlayerPerformanceSection>

	<PlayerPerformanceSection
		title={t('By faction')}
		summary={fill(t('{factions} factions · {games} games'), {
			factions: stats.byFaction.length,
			games: factionGames
		})}
		icon={FlagIcon}
		bind:expanded={factionExpanded}
	>
		<div class="hidden overflow-x-auto md:block">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class={headerRow}>
						<th class="px-4 py-2 text-left">{t('Faction')}</th>
						<th class="w-[3.25rem] px-2 py-2 text-center">{t('Games')}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{t('Wins')}</th>
						<th class="w-[4.75rem] px-2 py-2 text-center">{t('Losses')}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{t('Winrate')}</th>
					</tr>
				</thead>
				<tbody>
					{#each stats.byFaction as row (row.raceId)}
						{@const isFactionRowExpanded =
							factionRowDetail !== undefined && expandedFaction === row.raceId}
						<tr
							class={cn('border-secondary-800 border-b', factionRowDetail && interactive)}
							onclick={factionRowDetail ? () => toggleFactionRow(row) : undefined}
						>
							<td class="px-4 py-1.5">
								<div class="flex min-w-0 items-center gap-2">
									<img
										src={host.resolve.factionFlagByRace(row.raceId)}
										alt=""
										class="w-6 shrink-0 ring-2 ring-black"
									/>
									<span class="min-w-0 truncate text-white">{getRaceLabel(row.raceId)}</span>
								</div>
							</td>
							{@render statCells(row)}
						</tr>
						{#if isFactionRowExpanded && factionRowDetail}
							<tr>
								<td colspan={statColumnCount} class="border-secondary-800 border-b p-0">
									{@render factionRowDetail(row)}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<div class="divide-secondary-800 divide-y md:hidden">
			{#each stats.byFaction as row (row.raceId)}
				{@const isFactionRowExpanded =
					factionRowDetail !== undefined && expandedFaction === row.raceId}
				{#if factionRowDetail}
					<button
						type="button"
						class={cn('block w-full px-4 py-3 text-left text-white', interactive)}
						onclick={() => toggleFactionRow(row)}
					>
						{@render factionMobileCard(row)}
						{#if isFactionRowExpanded}
							<div class="border-secondary-800 mt-3 border-t pt-3">
								{@render factionRowDetail(row)}
							</div>
						{/if}
					</button>
				{:else}
					<div class="px-4 py-3 text-white">
						{@render factionMobileCard(row)}
					</div>
				{/if}
			{/each}
		</div>
	</PlayerPerformanceSection>

	<PlayerPerformanceSection
		title={t('By mode')}
		summary={fill(t('{modes} game modes · {games} games'), {
			modes: byMode.length,
			games: modeGames
		})}
		icon={UsersThreeIcon}
		bind:expanded={modeExpanded}
	>
		<div class="hidden overflow-x-auto md:block">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class={headerRow}>
						<th class="px-4 py-2 text-left">{t('Mode')}</th>
						<th class="w-[3.25rem] px-2 py-2 text-center">{t('Games')}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{t('Wins')}</th>
						<th class="w-[4.75rem] px-2 py-2 text-center">{t('Losses')}</th>
						<th class="w-[4.5rem] px-2 py-2 text-center">{t('Winrate')}</th>
					</tr>
				</thead>
				<tbody>
					{#each byMode as row (row.matchtypeId)}
						{@const modeRowExpanded =
							modeRowDetail !== undefined && expandedMode === row.matchtypeId}
						<tr
							class={cn('border-secondary-800 border-b', modeRowDetail && interactive)}
							onclick={modeRowDetail ? () => toggleModeRow(row) : undefined}
						>
							<td class="px-4 py-1.5 text-white">{getModeLabel(row.matchtypeId)}</td>
							{@render statCells(row)}
						</tr>
						{#if modeRowExpanded && modeRowDetail}
							<tr>
								<td colspan={statColumnCount} class="border-secondary-800 border-b p-0">
									{@render modeRowDetail(row)}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<div class="divide-secondary-800 divide-y md:hidden">
			{#each byMode as row (row.matchtypeId)}
				{@const modeRowExpanded = modeRowDetail !== undefined && expandedMode === row.matchtypeId}
				{#if modeRowDetail}
					<button
						type="button"
						class={cn('block w-full px-4 py-3 text-left text-white', interactive)}
						onclick={() => toggleModeRow(row)}
					>
						{@render modeMobileCard(row)}
						{#if modeRowExpanded}
							<div class="border-secondary-800 mt-3 border-t pt-3">
								{@render modeRowDetail(row)}
							</div>
						{/if}
					</button>
				{:else}
					<div class="px-4 py-3 text-white">
						{@render modeMobileCard(row)}
					</div>
				{/if}
			{/each}
		</div>
	</PlayerPerformanceSection>
{/if}
