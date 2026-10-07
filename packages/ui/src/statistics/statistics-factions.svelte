<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import { getRaceLabel } from '../format/player-format';
	import { formatCount, percent, winRateClass } from './format';
	import type { StatisticsFaction } from './types';

	type Props = {
		factions: StatisticsFaction[];
		compact?: boolean;
		class?: string;
	};

	let { factions, compact = false, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const picks = $derived(factions.reduce((total, row) => total + row.picks, 0));
</script>

<ul class={cn('divide-secondary-800 divide-y', className)}>
	{#each factions as row (row.raceId)}
		{@const decided = row.wins + row.losses}
		<li class={cn('flex items-center gap-3', compact ? 'px-4 py-2' : 'px-4 py-3')}>
			<img src={host.resolve.factionFlagByRace(row.raceId)} alt="" class={factionIcon} />
			<div class="min-w-0 flex-1">
				<p class="truncate font-medium text-white">{t(getRaceLabel(row.raceId))}</p>
				<p class="text-secondary-400 truncate text-xs">
					{t('{games} games · picked {share}', {
						games: formatCount(row.picks, host.locale()),
						share: percent(row.picks, picks)
					})}
				</p>
			</div>
			<div class="shrink-0 text-right">
				<p class={cn('font-bold tabular-nums', winRateClass(row.wins, decided))}>
					{percent(row.wins, decided)}
				</p>
				<p class="text-secondary-500 text-xs">{t('win rate')}</p>
			</div>
		</li>
	{/each}
</ul>
