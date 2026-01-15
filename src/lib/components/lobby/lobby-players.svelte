<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import * as Player from '$lib/components/player';
	import * as Table from '$lib/components/ui/table';
	import { groupBy, orderBy } from 'lodash-es';
	import { useLobby } from '.';
	import { getLeaderboardStatsForPlayerByMatchType, Race } from '$lib/utils/game';

	type Props = HTMLAttributes<HTMLDivElement>;

	const { ...restProps }: Props = $props();
	const lobby = $derived(useLobby());
</script>

<Table.Table {...restProps}>
	<Table.THead>
		<Table.tr>
			<Table.TH width="2/24" class="text-center">Rank</Table.TH>
			<Table.TH width="10/24">Alias</Table.TH>
			<Table.TH width="4/24" class="text-center">Wins</Table.TH>
			<Table.TH width="4/24" class="text-center">Losses</Table.TH>
			<Table.TH width="4/24" class="text-center">Streak</Table.TH>
		</Table.tr>
	</Table.THead>
	{#each orderBy(lobby.players, 'team') as player}
		{@const stats = getLeaderboardStatsForPlayerByMatchType(lobby.matchType, player)}
		{@const race = player.race}

		<Player.Root {player} {stats} {race}>
			<Table.TR>
				<Table.TD width="2/24" class="flex justify-center">
					<Player.Rank />
				</Table.TD>
				<Table.TD width="10/24" class="flex items-center gap-2">
					<Player.Faction />
					<Player.Alias />
					<Player.Country />
				</Table.TD>
				<Table.TD width="4/24" class="text-center">
					<Player.Wins />
				</Table.TD>
				<Table.TD width="4/24" class="text-center">
					<Player.Losses />
				</Table.TD>
				<Table.TD width="4/24" class="text-center">
					<Player.Streak />
				</Table.TD>
			</Table.TR>
		</Player.Root>
	{/each}
</Table.Table>
