<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		factionIcon,
		interactive,
		statLosses,
		statWins,
		tableHeadRow
	} from '@company-of-heroes/ui/variants';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import { resource } from 'runed';
	import { getModeLabel, getRaceLabel, getRatioColor, winrate } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import ReplayList from '../replay/replay-list.svelte';
	import ReplayListSkeleton from '../replay/replay-list-skeleton.svelte';
	import type { CommunityMatch } from '../replay/types';
	import type { HeadToHead } from './types';

	type Props = {
		record: HeadToHead;
		/** Rows open the games behind them (too wide for the chip popover). */
		expandable?: boolean;
	};

	let { record, expandable = false }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	// One row open at a time, across both sections.
	let expanded = $state<string | null>(null);
	let opened = $state(false);

	function toggle(key: string) {
		expanded = expanded === key ? null : key;
		opened = true;
	}

	// Every game's row, loaded once on the first expand and shared by all rows.
	const matches = resource(
		() => (opened ? record.games.map((game) => game.lobbyId).join(',') : null),
		async (ids) => (ids ? await host.api.players.headToHeadMatches(ids.split(',')) : [])
	);
	const matchById = $derived(new Map((matches.current ?? []).map((match) => [match.id, match])));

	function matchesOf(games: HeadToHead['games']): CommunityMatch[] {
		return games.flatMap((game) => matchById.get(game.lobbyId) ?? []);
	}
</script>

{#snippet caret(open: boolean)}
	{#if expandable}
		<CaretRightIcon
			size={12}
			weight="bold"
			class={cn('text-secondary-500 shrink-0 transition-transform', open && 'rotate-90')}
		/>
	{/if}
{/snippet}

{#snippet detail(games: HeadToHead['games'])}
	<!-- The list has no bottom line of its own; the cell closes it. -->
	<tr>
		<td colspan={5} class="border-secondary-800 border-b p-0">
			<!-- w-0 keeps the list's width out of the stat columns; it scrolls on its own. -->
			<div class="w-0 min-w-full">
				{#if matches.error}
					<p class="text-secondary-400 px-4 py-3 text-sm">{t('Could not load replays.')}</p>
				{:else if matches.loading || matches.current === undefined}
					<ReplayListSkeleton rowCount={Math.min(games.length, 10)} />
				{:else}
					<ReplayList
						matches={matchesOf(games)}
						meSteamIds={host.auth.user?.steamIds ?? []}
						highlightedPlayers={[String(record.profileId)]}
						sort="createdAt"
						sortDir="desc"
						onSort={() => {}}
						mapLabel={t('Map')}
						emptyMessage={t('No matches found.')}
					/>
				{/if}
			</div>
		</td>
	</tr>
{/snippet}

{#snippet statHeads(title: string)}
	<tr class={tableHeadRow}>
		<th scope="col" class="px-4 py-2 text-left">{title}</th>
		<th scope="col" class="w-[3.25rem] px-2 py-2 text-center">{t('Games')}</th>
		<th scope="col" class="w-[3.25rem] px-2 py-2 text-center">{t('Wins')}</th>
		<th scope="col" class="w-[3.75rem] px-2 py-2 text-center">{t('Losses')}</th>
		<th scope="col" class="w-[4.25rem] px-2 py-2 text-center">{t('Winrate')}</th>
	</tr>
{/snippet}

{#snippet statCells(row: { wins: number; losses: number })}
	<td class="text-secondary-300 px-2 py-1.5 text-center font-medium tabular-nums">
		{row.wins + row.losses}
	</td>
	<td class="{statWins} px-2 py-1.5 text-center font-medium">{row.wins}</td>
	<td class="{statLosses} px-2 py-1.5 text-center font-medium">{row.losses}</td>
	<td
		class="px-2 py-1.5 text-center font-medium tabular-nums"
		style:color={getRatioColor(row.wins, row.losses)}
	>
		{winrate(row.wins, row.losses)}
	</td>
{/snippet}

{#snippet faction(raceId: number)}
	<span class="flex min-w-0 items-center gap-2" title={getRaceLabel(raceId)}>
		<img
			src={host.resolve.factionFlagByRace(raceId)}
			alt={getRaceLabel(raceId)}
			class={factionIcon}
		/>
		<span class="hidden min-w-0 truncate text-white @sm:inline">{getRaceLabel(raceId)}</span>
	</span>
{/snippet}

<!-- Rows close themselves; -mb-px lands the last line on the parent's closing border. -->
<div class="@container -mb-px overflow-x-auto">
	<table class="w-full border-collapse text-sm">
		{#if record.byMatchup.length > 0}
			<tbody>
				{@render statHeads(t('By matchup'))}
				{#each record.byMatchup as row (`${row.raceId}-${row.theirRaceId}`)}
					{@const key = `matchup-${row.raceId}-${row.theirRaceId}`}
					<tr
						class={cn('border-secondary-800 border-b', expandable && interactive)}
						onclick={expandable ? () => toggle(key) : undefined}
					>
						<td class="max-w-0 px-4 py-1.5">
							<div class="flex min-w-0 items-center gap-2">
								{@render caret(expanded === key)}
								{@render faction(row.raceId)}
								<span class="text-secondary-500 shrink-0 text-xs">{t('vs')}</span>
								{@render faction(row.theirRaceId)}
							</div>
						</td>
						{@render statCells(row)}
					</tr>
					{#if expandable && expanded === key}
						{@render detail(
							record.games.filter(
								(game) => game.raceId === row.raceId && game.theirRaceId === row.theirRaceId
							)
						)}
					{/if}
				{/each}
			</tbody>
		{/if}
		{#if record.byMode.length > 0}
			<tbody>
				{@render statHeads(t('By mode'))}
				{#each record.byMode as row (row.matchtypeId)}
					{@const key = `mode-${row.matchtypeId}`}
					<tr
						class={cn('border-secondary-800 border-b', expandable && interactive)}
						onclick={expandable ? () => toggle(key) : undefined}
					>
						<td class="max-w-0 px-4 py-1.5 text-white">
							<div class="flex min-w-0 items-center gap-2">
								{@render caret(expanded === key)}
								<span class="min-w-0 truncate">{getModeLabel(row.matchtypeId)}</span>
							</div>
						</td>
						{@render statCells(row)}
					</tr>
					{#if expandable && expanded === key}
						{@render detail(record.games.filter((game) => game.matchtypeId === row.matchtypeId))}
					{/if}
				{/each}
			</tbody>
		{/if}
	</table>
</div>
