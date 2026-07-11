<script lang="ts">
	import type { LeaderboardStatWithProfile } from '@fknoobs/app';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { getRankImageByLeaderboardId } from '$lib/utils';
	import LeaderboardStatPill from './leaderboard-stat-pill.svelte';

	type Props = {
		stats: LeaderboardStatWithProfile[];
		loading?: boolean;
		empty?: string;
		class?: string;
	};

	let { stats, loading = false, empty = 'No players found.', class: className }: Props = $props();

	const centeredHeader = 'flex w-full justify-center';
	const centeredCell = 'flex w-full justify-center';

	const columns: ColumnDef<LeaderboardStatWithProfile>[] = [
		{
			id: 'rank',
			header: '#',
			width: 'w-[3rem]',
			headerClass: centeredHeader,
			class: `${centeredCell} text-secondary-400 font-semibold tabular-nums`,
			accessor: (stat) => stat.rank
		},
		{
			id: 'ranklevel',
			header: 'Rank',
			width: 'w-[5.5rem]',
			class: 'flex w-full items-center gap-2'
		},
		{
			id: 'alias',
			header: 'Alias',
			class: 'w-full truncate font-medium'
		},
		{
			id: 'wins',
			header: 'Wins',
			width: 'w-[4.5rem]',
			headerClass: centeredHeader,
			class: centeredCell
		},
		{
			id: 'losses',
			header: 'Losses',
			width: 'w-[4.5rem]',
			headerClass: centeredHeader,
			class: centeredCell
		},
		{
			id: 'streak',
			header: 'Streak',
			width: 'w-[4.5rem]',
			headerClass: centeredHeader,
			class: centeredCell
		},
		{
			id: 'ratio',
			header: 'Ratio',
			width: 'w-[4.5rem]',
			headerClass: centeredHeader,
			class: centeredCell
		}
	];
</script>

{#snippet cell_ranklevel({ row }: { row: LeaderboardStatWithProfile })}
	{#await getRankImageByLeaderboardId(row.leaderboard_id, row.ranklevel) then rankImage}
		<img src={rankImage} alt={`Rank ${row.ranklevel}`} class="size-6 shrink-0" />
	{/await}
	<span class="text-secondary-400 text-sm tabular-nums">{row.ranklevel}</span>
{/snippet}
{#snippet cell_alias({ row }: { row: LeaderboardStatWithProfile })}
	{row.profile?.alias}
{/snippet}
{#snippet cell_wins({ row }: { row: LeaderboardStatWithProfile })}
	<LeaderboardStatPill type="wins" wins={row.wins} losses={row.losses} streak={row.streak} />
{/snippet}
{#snippet cell_losses({ row }: { row: LeaderboardStatWithProfile })}
	<LeaderboardStatPill type="losses" wins={row.wins} losses={row.losses} streak={row.streak} />
{/snippet}
{#snippet cell_streak({ row }: { row: LeaderboardStatWithProfile })}
	<LeaderboardStatPill type="streak" wins={row.wins} losses={row.losses} streak={row.streak} />
{/snippet}
{#snippet cell_ratio({ row }: { row: LeaderboardStatWithProfile })}
	<LeaderboardStatPill type="ratio" wins={row.wins} losses={row.losses} streak={row.streak} />
{/snippet}

<DataTable
	class={className}
	data={stats}
	{columns}
	{loading}
	{empty}
	rowKey={(stat) => stat.profile.profile_id}
	rowHref={(stat) => `/players/${stat.profile.profile_id}`}
	tableLayout="auto"
	cells={{
		ranklevel: cell_ranklevel,
		alias: cell_alias,
		wins: cell_wins,
		losses: cell_losses,
		streak: cell_streak,
		ratio: cell_ratio
	}}
/>
