<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import * as Player from '$lib/components/player';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { orderBy } from 'lodash-es';
	import { useLobby } from '.';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import type { LobbyPlayer } from '@fknoobs/app';
	import { useI18n } from '$lib/i18n';

	type Props = HTMLAttributes<HTMLDivElement> & {
		embedded?: boolean;
	};

	const { embedded = false, ...restProps }: Props = $props();
	const { t } = useI18n();
	const lobby = useLobby();

	const players = $derived(orderBy(lobby.players, 'team'));

	const columns = $derived.by((): ColumnDef<LobbyPlayer>[] => {
		const cellPad = embedded ? '!px-3 !py-2' : undefined;
		const centered = 'flex w-full justify-center tabular-nums';

		return [
			{
				id: 'rank',
				header: t('Rank'),
				width: 'w-2/24',
				headerClass: 'flex justify-center',
				headerCellClass: cellPad,
				cellClass: () => cellPad ?? '',
				class: centered
			},
			{
				id: 'alias',
				header: t('Alias'),
				width: 'w-10/24',
				headerCellClass: cellPad,
				cellClass: () => cellPad ?? '',
				class: 'flex items-center gap-2'
			},
			{
				id: 'wins',
				header: t('Wins'),
				width: 'w-4/24',
				headerClass: 'flex justify-center',
				headerCellClass: cellPad,
				cellClass: () => cellPad ?? '',
				class: centered
			},
			{
				id: 'losses',
				header: t('Losses'),
				width: 'w-4/24',
				headerClass: 'flex justify-center',
				headerCellClass: cellPad,
				cellClass: () => cellPad ?? '',
				class: centered
			},
			{
				id: 'streak',
				header: t('Streak'),
				width: 'w-4/24',
				headerClass: 'flex justify-center',
				headerCellClass: cellPad,
				cellClass: () => cellPad ?? '',
				class: centered
			}
		];
	});
</script>

{#snippet cell_rank({ row }: { row: LobbyPlayer })}
	<Player.Rank />
{/snippet}
{#snippet cell_alias({ row }: { row: LobbyPlayer })}
	<Player.Faction />
	<Player.Alias />
	<Player.Country />
{/snippet}
{#snippet cell_wins({ row }: { row: LobbyPlayer })}
	<Player.Wins />
{/snippet}
{#snippet cell_losses({ row }: { row: LobbyPlayer })}
	<Player.Losses />
{/snippet}
{#snippet cell_streak({ row }: { row: LobbyPlayer })}
	<Player.Streak />
{/snippet}
{#snippet playerRowWrapper({
	row,
	children
}: {
	row: LobbyPlayer;
	children: import('svelte').Snippet;
})}
	{@const stats = getLeaderboardStatsForPlayerByMatchType(lobby.matchType, row)}
	{@const race = row.race}
	<Player.Root player={row} {stats} {race}>
		{@render children()}
	</Player.Root>
{/snippet}

<div {...restProps}>
	<DataTable
		data={players}
		{columns}
		rowKey={(player) => player.index}
		rowWrapper={playerRowWrapper}
		class={embedded ? 'border-secondary-800 rounded-none border-0 border-t' : undefined}
		headerClass={embedded ? 'bg-transparent' : undefined}
		headerRowClass={embedded
			? 'bg-transparent text-secondary-400 h-9 text-xs font-semibold tracking-wide uppercase'
			: undefined}
		bodyRowClass={embedded ? 'h-9 odd:bg-secondary-600/5' : undefined}
		cells={{
			rank: cell_rank,
			alias: cell_alias,
			wins: cell_wins,
			losses: cell_losses,
			streak: cell_streak
		}}
	/>
</div>
