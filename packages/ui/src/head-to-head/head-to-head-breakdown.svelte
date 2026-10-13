<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { factionIcon, statLosses, statWins, tableHeadRow } from '@company-of-heroes/ui/variants';
	import { getModeLabel, getRaceLabel, getRatioColor, winrate } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import type { HeadToHead } from './types';

	type Props = {
		record: HeadToHead;
	};

	let { record }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
</script>

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
					<tr class="border-secondary-800 border-b">
						<td class="max-w-0 px-4 py-1.5">
							<div class="flex min-w-0 items-center gap-2">
								{@render faction(row.raceId)}
								<span class="text-secondary-500 shrink-0 text-xs">{t('vs')}</span>
								{@render faction(row.theirRaceId)}
							</div>
						</td>
						{@render statCells(row)}
					</tr>
				{/each}
			</tbody>
		{/if}
		{#if record.byMode.length > 0}
			<tbody>
				{@render statHeads(t('By mode'))}
				{#each record.byMode as row (row.matchtypeId)}
					<tr class="border-secondary-800 border-b">
						<td class="max-w-0 truncate px-4 py-1.5 text-white">{getModeLabel(row.matchtypeId)}</td>
						{@render statCells(row)}
					</tr>
				{/each}
			</tbody>
		{/if}
	</table>
</div>
