<script lang="ts">
	import type { LeaderboardStat } from '@fknoobs/app';
	import { DataTable, type ColumnDef, type SortDirection } from '$lib/components/ui/table';
	import { cn, getRankImage } from '$lib/utils';
	import {
		getFactionFlagFromLeaderboardId,
		getLeaderboardType,
		getRaceFromLeaderboardId,
		isRanked
	} from '$lib/utils/game';
	import { getStoredEloForLeaderboard, type PlayerEloMap } from '$lib/utils/player-elo';
	import LeaderboardStatPill from './leaderboard-stat-pill.svelte';
	import { getEloColor, getEloTextShadow, isEliteElo } from './leaderboard-utils';
	import { orderBy, sortBy } from 'lodash-es';
	import { useI18n } from '$lib/i18n';

	type Props = {
		stats: LeaderboardStat[];
		elo?: PlayerEloMap;
		loading?: boolean;
		skeletonRows?: number;
		empty?: string;
		class?: string;
		wrapperClass?: string;
	};

	let {
		stats,
		elo,
		loading = false,
		skeletonRows = 5,
		empty = 'No stats found.',
		class: className,
		wrapperClass
	}: Props = $props();
	const { t } = useI18n();

	let eloSort = $state<SortDirection>(null);

	const sortedStats = $derived.by(() => {
		if (!eloSort) {
			return sortBy(orderBy(stats, 'ranklevel', 'desc'), (stat) =>
				isRanked(stat.leaderboard_id) ? 0 : 1
			);
		}
		return orderBy(
			stats,
			[
				(stat) => {
					const value = getStoredEloForLeaderboard(elo, stat.leaderboard_id);
					if (value == null) {
						return eloSort === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
					}
					return value;
				}
			],
			[eloSort]
		);
	});

	function toggleEloSort() {
		eloSort = eloSort === 'desc' ? 'asc' : eloSort === 'asc' ? null : 'desc';
	}

	const leftHeader = 'flex w-full justify-center';
	const leftCell = 'flex w-full justify-center';
	const statHeader = 'flex w-full justify-center';
	const statCell = 'flex w-full justify-center';

	const columns: ColumnDef<LeaderboardStat>[] = $derived([
		{
			id: 'elo',
			header: t('ELO'),
			width: 'w-[6.5rem]',
			headerClass: leftHeader,
			class: `${leftCell} tabular-nums`,
			sortable: true,
			onSort: toggleEloSort,
			sortDirection: eloSort
		},
		{
			id: 'level',
			header: t('Level'),
			width: 'w-[5rem]',
			headerClass: leftHeader,
			class: `${leftCell} gap-2`
		},
		{
			id: 'mode',
			header: t('Type'),
			width: 'w-[14rem]',
			headerClass: leftHeader,
			class: `${leftCell} gap-2`
		},
		{
			id: 'position',
			header: t('Position'),
			width: 'w-[4.5rem]',
			headerClass: leftHeader,
			class: leftCell
		},
		{
			id: 'spacer',
			header: '',
			headerCellClass: 'p-0',
			cellClass: () => 'p-0',
			hideSkeleton: true
		},
		{
			id: 'wins',
			header: t('Wins'),
			width: 'w-[4.5rem]',
			headerClass: statHeader,
			class: statCell
		},
		{
			id: 'losses',
			header: t('Losses'),
			width: 'w-[5.5rem]',
			headerClass: statHeader,
			class: statCell
		},
		{
			id: 'streak',
			header: t('Streak'),
			width: 'w-[5rem]',
			headerClass: statHeader,
			class: statCell
		}
	]);
</script>

{#snippet cell_level({ row }: { row: LeaderboardStat })}
	{#if isRanked(row.leaderboard_id)}
		<img
			src={getRankImage(getRaceFromLeaderboardId(row.leaderboard_id), row.ranklevel)}
			alt={t('Rank')}
			class="size-6 shrink-0"
		/>
		<span class="font-semibold tabular-nums">{row.ranklevel}</span>
	{:else}
		<span class="text-secondary-400 tabular-nums">-</span>
	{/if}
{/snippet}
{#snippet cell_mode({ row }: { row: LeaderboardStat })}
	<img
		src={getFactionFlagFromLeaderboardId(row.leaderboard_id)}
		alt={t('Faction')}
		class="w-6 shrink-0 ring-2 ring-black"
	/>
	<span class="shrink-0 text-base whitespace-nowrap">{getLeaderboardType(row.leaderboard_id)}</span>
{/snippet}
{#snippet cell_position({ row }: { row: LeaderboardStat })}
	<span class="inline-flex items-center justify-center gap-1 tabular-nums">
		{#if row.rank === 1}
			<span class="relative -top-0.5">👑</span>
		{/if}
		<span class={cn(row.rank === 1 && 'text-primary font-bold')}>
			{row.rank === -1 ? '-' : row.rank}
		</span>
	</span>
{/snippet}
{#snippet cell_elo({ row }: { row: LeaderboardStat })}
	{@const value = getStoredEloForLeaderboard(elo, row.leaderboard_id)}
	{#if value == null}
		<span class="text-secondary-500 text-xs">{t('N/A')}</span>
	{:else}
		<span
			class={cn('tabular-nums', isEliteElo(value) ? 'font-bold tracking-wide' : 'font-medium')}
			style:color={getEloColor(value)}
			style:text-shadow={getEloTextShadow(value)}
		>
			{value}
		</span>
	{/if}
{/snippet}
{#snippet cell_wins({ row }: { row: LeaderboardStat })}
	<LeaderboardStatPill type="wins" wins={row.wins} losses={row.losses} streak={row.streak} />
{/snippet}
{#snippet cell_losses({ row }: { row: LeaderboardStat })}
	<LeaderboardStatPill type="losses" wins={row.wins} losses={row.losses} streak={row.streak} />
{/snippet}
{#snippet cell_streak({ row }: { row: LeaderboardStat })}
	<LeaderboardStatPill type="streak" wins={row.wins} losses={row.losses} streak={row.streak} />
{/snippet}

<div class={cn('overflow-x-auto', wrapperClass)}>
	<DataTable
		class={cn('w-full', className)}
		data={sortedStats}
		{columns}
		{loading}
		{skeletonRows}
		empty={t(empty)}
		tableLayout="fixed"
		rowKey={(stat) => `${stat.statgroup_id}-${stat.leaderboard_id}`}
		cells={{
			level: cell_level,
			mode: cell_mode,
			position: cell_position,
			elo: cell_elo,
			wins: cell_wins,
			losses: cell_losses,
			streak: cell_streak
		}}
	/>
</div>
