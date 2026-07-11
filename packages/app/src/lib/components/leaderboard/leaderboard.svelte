<script lang="ts">
	import type { LeaderboardStat } from '@fknoobs/app';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { cn, getRankImage } from '$lib/utils';
	import {
		getFactionFlagFromLeaderboardId,
		getLeaderboardType,
		getRaceFromLeaderboardId,
		isRanked
	} from '$lib/utils/game';
	import LeaderboardStatPill from './leaderboard-stat-pill.svelte';
	import { orderBy, sortBy } from 'lodash-es';

	type Props = {
		stats: LeaderboardStat[];
		loading?: boolean;
		empty?: string;
		class?: string;
	};

	let { stats, loading = false, empty = 'No stats found.', class: className }: Props = $props();

	const sortedStats = $derived(
		sortBy(orderBy(stats, 'ranklevel', 'desc'), (stat) => (isRanked(stat.leaderboard_id) ? 0 : 1))
	);

	const leftHeader = 'flex w-full justify-center';
	const leftCell = 'flex w-full justify-center';
	const statHeader = 'flex w-full justify-center';
	const statCell = 'flex w-full justify-center';

	const columns: ColumnDef<LeaderboardStat>[] = [
		{
			id: 'level',
			header: 'Level',
			width: 'w-[5rem]',
			headerClass: leftHeader,
			class: `${leftCell} gap-2`
		},
		{
			id: 'mode',
			header: 'Type',
			width: 'w-[14rem]',
			headerClass: leftHeader,
			class: `${leftCell} gap-2`
		},
		{
			id: 'position',
			header: 'Position',
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
			header: 'Wins',
			width: 'w-[4.5rem]',
			headerClass: statHeader,
			class: statCell
		},
		{
			id: 'losses',
			header: 'Losses',
			width: 'w-[5.5rem]',
			headerClass: statHeader,
			class: statCell
		},
		{
			id: 'streak',
			header: 'Streak',
			width: 'w-[5rem]',
			headerClass: statHeader,
			class: statCell
		}
	];
</script>

{#snippet cell_level({ row }: { row: LeaderboardStat })}
	{#if isRanked(row.leaderboard_id)}
		{#await getRankImage(getRaceFromLeaderboardId(row.leaderboard_id), row.ranklevel) then rankImg}
			<img src={rankImg} alt="Rank" class="size-6 shrink-0" />
		{/await}
		<span class="font-semibold tabular-nums">{row.ranklevel}</span>
	{:else}
		<span class="text-secondary-400 tabular-nums">-</span>
	{/if}
{/snippet}
{#snippet cell_mode({ row }: { row: LeaderboardStat })}
	<img
		src={getFactionFlagFromLeaderboardId(row.leaderboard_id)}
		alt="Faction"
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
{#snippet cell_wins({ row }: { row: LeaderboardStat })}
	<LeaderboardStatPill type="wins" wins={row.wins} losses={row.losses} streak={row.streak} />
{/snippet}
{#snippet cell_losses({ row }: { row: LeaderboardStat })}
	<LeaderboardStatPill type="losses" wins={row.wins} losses={row.losses} streak={row.streak} />
{/snippet}
{#snippet cell_streak({ row }: { row: LeaderboardStat })}
	<LeaderboardStatPill type="streak" wins={row.wins} losses={row.losses} streak={row.streak} />
{/snippet}

<div class="overflow-x-auto">
	<DataTable
		class={cn('w-full', className)}
		data={sortedStats}
		{columns}
		{loading}
		{empty}
		tableLayout="fixed"
		rowKey={(stat) => `${stat.statgroup_id}-${stat.leaderboard_id}`}
		cells={{
			level: cell_level,
			mode: cell_mode,
			position: cell_position,
			wins: cell_wins,
			losses: cell_losses,
			streak: cell_streak
		}}
	/>
</div>
