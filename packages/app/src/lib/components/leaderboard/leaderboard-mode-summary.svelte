<script lang="ts">
	import type { LeaderboardStat } from '@fknoobs/app';
	import { cn, getRankImageByLeaderboardId } from '$lib/utils';
	import { getFactionFlagFromLeaderboardId } from '$lib/utils/game';
	import type { PlayerEloMap } from '$lib/utils/player-elo';
	import {
		buildRankedModeRows,
		getEloColor,
		getEloTextShadow,
		getRaceLabelFromLeaderboardId,
		isEliteElo
	} from './leaderboard-utils';
	import { useI18n } from '$lib/i18n';

	type Props = {
		stats: LeaderboardStat[];
		elo?: PlayerEloMap;
		class?: string;
	};

	let { stats, elo, class: className }: Props = $props();
	const { t } = useI18n();

	const rows = $derived(buildRankedModeRows(stats, elo));
</script>

<div
	class={cn('col-span-4 grid min-h-0', className)}
	style:grid-template-columns="repeat({Math.max(rows.length, 1)}, minmax(0, 1fr))"
>
	{#each rows as row (row.label)}
		<div
			class="border-secondary-800 flex h-full flex-col items-center justify-center border-r px-2 py-3 text-center last:border-r-0"
		>
			<dt class="text-secondary-500 text-xs font-medium uppercase">{row.label}</dt>
			<dd class="mt-1 flex flex-col items-center gap-1">
				<span class="inline-flex items-center gap-1.5">
					<img
						src={getFactionFlagFromLeaderboardId(row.stat.leaderboard_id)}
						alt={getRaceLabelFromLeaderboardId(row.stat.leaderboard_id)}
						class="h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-black/40"
					/>
					{#if row.rating == null}
						<span class="text-secondary-500 text-sm">{t('N/A')}</span>
					{:else}
						<span
							class={cn(
								'font-heading text-lg tabular-nums',
								isEliteElo(row.rating) ? 'font-bold tracking-wide' : 'font-medium'
							)}
							style:color={getEloColor(row.rating)}
							style:text-shadow={getEloTextShadow(row.rating)}
						>
							{row.rating}
						</span>
					{/if}
				</span>
				{#if row.stat.ranklevel > 0}
					<span class="inline-flex items-center gap-1">
						<img
							src={getRankImageByLeaderboardId(row.stat.leaderboard_id, row.stat.ranklevel)}
							alt={t('Rank {level}', { level: row.stat.ranklevel })}
							class="h-6 w-auto shrink-0"
						/>
						<span class="text-secondary-300 text-sm font-medium tabular-nums">
							{row.stat.ranklevel}
						</span>
					</span>
				{/if}
			</dd>
		</div>
	{/each}
</div>
