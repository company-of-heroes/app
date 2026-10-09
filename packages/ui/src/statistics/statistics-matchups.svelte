<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, tableHeadRow } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import { getRaceLabel } from '../format/player-format';
	import { formatCount, percent, winRateClass } from './format';
	import { useStatistics } from './context';

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const context = useStatistics();
	const matchups = $derived(context.statistics.matchups);
	const ALLIES = [0, 2];
	const AXIS = [1, 3];

	function find(alliesRaceId: number, axisRaceId: number) {
		return matchups.find(
			(row) => row.alliesRaceId === alliesRaceId && row.axisRaceId === axisRaceId
		);
	}
</script>

<div class={cn('overflow-x-auto', className)}>
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class={tableHeadRow}>
				<th class="px-4 py-2 text-left">{t('Allies win vs')}</th>
				{#each AXIS as axisRaceId (axisRaceId)}
					<th class="px-4 py-2 text-left">
						<span class="flex items-center gap-2">
							<img src={host.resolve.factionFlagByRace(axisRaceId)} alt="" class={factionIcon} />
							{t(getRaceLabel(axisRaceId))}
						</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each ALLIES as alliesRaceId (alliesRaceId)}
				<tr class="border-secondary-800 border-b last:border-b-0">
					<th class="px-4 py-2.5 text-left font-medium text-white">
						<span class="flex items-center gap-2">
							<img src={host.resolve.factionFlagByRace(alliesRaceId)} alt="" class={factionIcon} />
							{t(getRaceLabel(alliesRaceId))}
						</span>
					</th>
					{#each AXIS as axisRaceId (axisRaceId)}
						{@const matchup = find(alliesRaceId, axisRaceId)}
						<td class="px-4 py-2.5">
							{#if matchup}
								<span
									class={cn(
										'font-bold tabular-nums',
										winRateClass(matchup.alliesWins, matchup.games)
									)}
								>
									{percent(matchup.alliesWins, matchup.games)}
								</span>
								<span class="text-secondary-400 ml-1 text-xs whitespace-nowrap">
									{t('{games} games', { games: formatCount(matchup.games, host.locale()) })}
								</span>
							{:else}
								<span class="text-secondary-500">-</span>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
