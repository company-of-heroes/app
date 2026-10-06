<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import { getRaceLabel } from '../format/player-format';
	import { doctrineBannerFile } from '../replay/replay-stats';
	import { formatCount, percent, winRateClass } from './format';
	import type { StatisticsDoctrine, StatisticsReplayPlayers } from './types';

	type Props = {
		doctrines: StatisticsDoctrine[];
		replayPlayers: StatisticsReplayPlayers[];
		class?: string;
	};

	let { doctrines, replayPlayers, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const RACES = [0, 2, 1, 3];

	function bannerUrl(row: StatisticsDoctrine): string | null {
		const file = doctrineBannerFile({
			doctrine: row.doctrine,
			faction: row.raceId === 0 || row.raceId === 2 ? 'allies' : 'axis'
		});
		return file ? host.resolve.doctrineBanner(file) : null;
	}
</script>

<div class={cn('bg-secondary-800 grid gap-px sm:grid-cols-2 xl:grid-cols-4', className)}>
	{#each RACES as raceId (raceId)}
		{@const rows = doctrines.filter((row) => row.raceId === raceId)}
		{@const picks = rows.reduce((total, row) => total + row.picks, 0)}
		<section class="bg-gray-950">
			<h3 class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white">
				<img src={host.resolve.factionFlagByRace(raceId)} alt="" class={factionIcon} />
				{t(getRaceLabel(raceId))}
				<span class="text-secondary-500 ml-auto text-xs font-normal tabular-nums">
					{t('{count} players', {
						count: formatCount(
							replayPlayers.find((entry) => entry.raceId === raceId)?.players ?? 0,
							host.locale()
						)
					})}
				</span>
			</h3>
			{#if rows.length === 0}
				<p class="text-secondary-500 border-secondary-800 border-t px-4 py-3 text-sm">-</p>
			{/if}
			{#each rows as row (row.doctrine)}
				{@const banner = bannerUrl(row)}
				<div class="border-secondary-800 relative overflow-hidden border-t">
					{#if banner}
						<img
							src={banner}
							alt=""
							aria-hidden="true"
							class="pointer-events-none absolute inset-0 h-full w-full object-cover object-left opacity-[0.16]"
						/>
						<div
							class="from-secondary-950/25 via-secondary-950/60 to-secondary-950/92 pointer-events-none absolute inset-0 bg-linear-to-r"
						></div>
					{/if}
					<div class="relative flex items-center gap-3 px-4 py-2.5">
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium text-white">{row.name}</p>
							<p class="text-secondary-400 text-xs tabular-nums">
								{t('picked {share}', { share: percent(row.picks, picks) })}
							</p>
						</div>
						<div class="shrink-0 text-right">
							<p class={cn('font-bold tabular-nums', winRateClass(row.wins, row.decided))}>
								{percent(row.wins, row.decided)}
							</p>
							<p class="text-secondary-500 text-xs">{t('win rate')}</p>
						</div>
					</div>
				</div>
			{/each}
		</section>
	{/each}
</div>
