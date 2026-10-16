<script lang="ts">
	import { RankIcon } from '@company-of-heroes/ui/player';
	import type { LeaderboardStat } from '@fknoobs/app';
	import { cn } from '$lib/utils';
	import { factionIcon } from '$lib/components/ui/variants';
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
						class={factionIcon}
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
						<RankIcon
							level={row.stat.ranklevel}
							leaderboardId={row.stat.leaderboard_id}
							position={row.stat.rank}
							class="size-auto h-6"
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
