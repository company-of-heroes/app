<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tableHeadRow, tableHeadText, factionIcon } from '@company-of-heroes/ui/variants';
	import {
		getStoredEloForLeaderboard,
		getEloColor,
		getEloTextShadow,
		isEliteElo,
		isRankedLeaderboard,
		sortLeaderboardStats
	} from '../format/player-format';
	import { getLeaderboardTypeLabel } from '../format/ranks';
	import LeaderboardStatPill from '../leaderboard/leaderboard-stat-pill.svelte';
	import { Skeleton } from '../ui/skeleton';
	import type { LeaderboardStat, PlayerEloMap } from './types';
	import { useHost } from '../host/host.context';

	type Props = {
		stats: LeaderboardStat[];
		elo?: PlayerEloMap;
		loading?: boolean;
		skeletonRows?: number;
	};

	let { stats: rawStats, elo: eloMap, loading = false, skeletonRows = 5 }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const stats = $derived(sortLeaderboardStats(rawStats));
	const totalWins = $derived(stats.reduce((sum, stat) => sum + stat.wins, 0));
	const totalLosses = $derived(stats.reduce((sum, stat) => sum + stat.losses, 0));

	function positionLabel(leaderboardId: number, rank: number): string {
		if (!isRankedLeaderboard(leaderboardId) || rank <= 0) {
			return '-';
		}

		return String(rank);
	}
</script>

{#if loading}
	<div class="divide-secondary-800 divide-y" aria-busy="true">
		{#each Array(skeletonRows) as _, index (index)}
			<div class="flex items-center gap-4 px-4 py-3">
				<Skeleton class="h-4 w-12" />
				<Skeleton class="size-6" />
				<Skeleton class="h-4 w-28 grow" />
				<Skeleton class="h-4 w-10" />
				<Skeleton class="h-4 w-10" />
			</div>
		{/each}
	</div>
{:else if stats.length === 0}
	<p class="text-secondary-400 px-4 py-3 text-sm">{t('No leaderboard stats yet.')}</p>
{:else}
	<div class="hidden overflow-x-auto md:block">
		<table class="w-full table-fixed text-sm">
			<thead>
				<tr class={tableHeadRow}>
					<th class="w-[6.5rem] px-4 py-2">
						<div class="flex w-full justify-center">{t('ELO')}</div>
					</th>
					<th class="w-[5rem] px-4 py-2">
						<div class="flex w-full justify-center">{t('Level')}</div>
					</th>
					<th class="w-[14rem] px-4 py-2">
						<div class="flex w-full justify-center">{t('Type')}</div>
					</th>
					<th class="w-[4.5rem] px-4 py-2">
						<div class="flex w-full justify-center">{t('Position')}</div>
					</th>
					<th class="w-auto p-0"></th>
					<th class="w-[4.5rem] px-4 py-2">
						<div class="flex w-full justify-center">{t('Wins')}</div>
					</th>
					<th class="w-[5.5rem] px-4 py-2">
						<div class="flex w-full justify-center">{t('Losses')}</div>
					</th>
					<th class="w-[5rem] px-4 py-2">
						<div class="flex w-full justify-center">{t('Streak')}</div>
					</th>
				</tr>
			</thead>
			<tbody>
				{#each stats as stat (stat.leaderboard_id)}
					{@const elo = getStoredEloForLeaderboard(eloMap, stat.leaderboard_id)}
					{@const ranked = isRankedLeaderboard(stat.leaderboard_id)}
					<tr class="border-secondary-800 h-11 border-b">
						<td class="px-4 py-1.5">
							<div class="flex h-full w-full min-w-0 items-center justify-center">
								{#if elo == null}
									<span class="text-secondary-500 text-xs">{t('N/A')}</span>
								{:else}
									<span
										class={cn(
											'tabular-nums',
											isEliteElo(elo) ? 'font-bold tracking-wide' : 'font-medium'
										)}
										style:color={getEloColor(elo)}
										style:text-shadow={getEloTextShadow(elo)}
									>
										{elo}
									</span>
								{/if}
							</div>
						</td>
						<td class="px-4 py-1.5">
							<div class="flex h-full w-full min-w-0 items-center justify-center gap-2">
								{#if ranked}
									<img
										src={host.resolve.rankImageByLeaderboard(stat.leaderboard_id, stat.ranklevel)}
										alt=""
										class="size-6 shrink-0 object-contain"
									/>
									<span class="font-semibold tabular-nums">
										{stat.ranklevel > 0 ? stat.ranklevel : '-'}
									</span>
								{:else}
									<span class="text-secondary-400 tabular-nums">-</span>
								{/if}
							</div>
						</td>
						<td class="px-4 py-1.5">
							<div class="flex h-full w-full min-w-0 items-center justify-center gap-2">
								<img
									src={host.resolve.factionFlagByLeaderboard(stat.leaderboard_id)}
									alt=""
									class={factionIcon}
								/>
								<span class="shrink-0 text-base whitespace-nowrap">
									{getLeaderboardTypeLabel(stat.leaderboard_id)}
								</span>
							</div>
						</td>
						<td class="px-4 py-1.5">
							<div class="flex h-full w-full min-w-0 items-center justify-center">
								<span class="inline-flex items-center justify-center gap-1 tabular-nums">
									{#if stat.rank === 1}
										<span class="relative -top-0.5">👑</span>
									{/if}
									<span class={cn(stat.rank === 1 && 'text-primary font-bold')}>
										{positionLabel(stat.leaderboard_id, stat.rank)}
									</span>
								</span>
							</div>
						</td>
						<td class="p-0"></td>
						<td class="px-4 py-1.5">
							<div class="flex h-full w-full min-w-0 items-center justify-center">
								<LeaderboardStatPill
									type="wins"
									wins={stat.wins}
									losses={stat.losses}
									streak={stat.streak}
								/>
							</div>
						</td>
						<td class="px-4 py-1.5">
							<div class="flex h-full w-full min-w-0 items-center justify-center">
								<LeaderboardStatPill
									type="losses"
									wins={stat.wins}
									losses={stat.losses}
									streak={stat.streak}
								/>
							</div>
						</td>
						<td class="px-4 py-1.5">
							<div class="flex h-full w-full min-w-0 items-center justify-center">
								<LeaderboardStatPill
									type="streak"
									wins={stat.wins}
									losses={stat.losses}
									streak={stat.streak}
								/>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr class="bg-secondary-950/90 h-11">
					<td colspan="5" class="px-4 py-1.5">
						<div class="flex items-center gap-2">
							<span class={tableHeadText}>{t('Total')}</span>
							<span class="font-medium text-white tabular-nums">{totalWins + totalLosses}</span>
							<span class="text-secondary-400">{t('Games')}</span>
						</div>
					</td>
					<td class="px-4 py-1.5">
						<div class="flex h-full w-full min-w-0 items-center justify-center">
							<LeaderboardStatPill type="wins" wins={totalWins} losses={totalLosses} streak={0} />
						</div>
					</td>
					<td class="px-4 py-1.5">
						<div class="flex h-full w-full min-w-0 items-center justify-center">
							<LeaderboardStatPill type="losses" wins={totalWins} losses={totalLosses} streak={0} />
						</div>
					</td>
					<td class="px-4 py-1.5"></td>
				</tr>
			</tfoot>
		</table>
	</div>

	<div class="divide-secondary-800 divide-y md:hidden">
		{#each stats as stat (stat.leaderboard_id)}
			{@const elo = getStoredEloForLeaderboard(eloMap, stat.leaderboard_id)}
			{@const ranked = isRankedLeaderboard(stat.leaderboard_id)}
			<div class="px-4 py-3 text-white">
				<div class="flex min-w-0 items-center gap-2">
					<img
						src={host.resolve.factionFlagByLeaderboard(stat.leaderboard_id)}
						alt=""
						class={factionIcon}
					/>
					<span class="min-w-0 truncate text-base whitespace-nowrap">
						{getLeaderboardTypeLabel(stat.leaderboard_id)}
					</span>
					<div class="ml-auto flex shrink-0 items-center gap-3">
						{#if elo == null}
							<span class="text-secondary-500 text-xs">{t('N/A')}</span>
						{:else}
							<span
								class={cn(
									'tabular-nums',
									isEliteElo(elo) ? 'font-bold tracking-wide' : 'font-medium'
								)}
								style:color={getEloColor(elo)}
								style:text-shadow={getEloTextShadow(elo)}
							>
								{elo}
							</span>
						{/if}
						<span class="inline-flex items-center gap-1 tabular-nums">
							{#if stat.rank === 1}
								<span class="relative -top-0.5">👑</span>
							{/if}
							<span class={cn(stat.rank === 1 && 'text-primary font-bold')}>
								{positionLabel(stat.leaderboard_id, stat.rank)}
							</span>
						</span>
					</div>
				</div>
				<div class="text-secondary-400 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
					{#if ranked}
						<span class="inline-flex items-center gap-2">
							<img
								src={host.resolve.rankImageByLeaderboard(stat.leaderboard_id, stat.ranklevel)}
								alt=""
								class="size-6 shrink-0 object-contain"
							/>
							<span class="font-semibold text-white tabular-nums">
								{stat.ranklevel > 0 ? stat.ranklevel : '-'}
							</span>
						</span>
					{/if}
					<span class="inline-flex items-center gap-1">
						{t('Wins')}
						<LeaderboardStatPill
							type="wins"
							wins={stat.wins}
							losses={stat.losses}
							streak={stat.streak}
						/>
					</span>
					<span class="inline-flex items-center gap-1">
						{t('Losses')}
						<LeaderboardStatPill
							type="losses"
							wins={stat.wins}
							losses={stat.losses}
							streak={stat.streak}
						/>
					</span>
					<span class="inline-flex items-center gap-1">
						{t('Streak')}
						<LeaderboardStatPill
							type="streak"
							wins={stat.wins}
							losses={stat.losses}
							streak={stat.streak}
						/>
					</span>
				</div>
			</div>
		{/each}
		<div
			class="bg-secondary-950/90 text-secondary-400 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
		>
			<span class={tableHeadText}>{t('Total')}</span>
			<span class="inline-flex items-center gap-1">
				{t('Games')}
				<span class="font-medium text-white tabular-nums">{totalWins + totalLosses}</span>
			</span>
			<span class="inline-flex items-center gap-1">
				{t('Wins')}
				<LeaderboardStatPill type="wins" wins={totalWins} losses={totalLosses} streak={0} />
			</span>
			<span class="inline-flex items-center gap-1">
				{t('Losses')}
				<LeaderboardStatPill type="losses" wins={totalWins} losses={totalLosses} streak={0} />
			</span>
		</div>
	</div>
{/if}
