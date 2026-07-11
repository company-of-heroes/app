<script lang="ts">
	import type { ReplayData } from '@fknoobs/replay-parser';
	import type { Snapshot } from './$types';
	import * as Lobby from '$lib/components/lobby';
	import * as Player from '$lib/components/player';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import { app } from '$core/app/context';
	import { cn } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import { ButtonBack } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const playerStatsColumns: ColumnDef<{ id: number }>[] = [
		{ id: 'rank', header: 'Rank', width: 'w-6/24', headerClass: 'text-secondary-200 text-center text-lg font-medium', class: 'flex items-center justify-center gap-2 text-lg' },
		{ id: 'position', header: 'Position', width: 'w-6/24', headerClass: 'text-secondary-200 text-center text-lg font-medium', class: 'text-center text-lg' },
		{ id: 'wins', header: 'Wins', width: 'w-6/24', headerClass: 'text-secondary-200 text-center text-lg font-medium', class: 'text-center text-lg' },
		{ id: 'losses', header: 'Losses', width: 'w-6/24', headerClass: 'text-secondary-200 text-center text-lg font-medium', class: 'text-center text-lg' }
	];

	let match = $derived(app.lobby);
	let replay = $state<{
		file: File;
		replay: ReplayData;
	} | null>(null);

	app.on('lobby.saved', (match) => {
		goto(resolve('/(loaded)/history/[id]', { id: match.id }));
	});

	$effect(() => {
		if (!match) {
			goto('/');
		}
	});

	export const snapshot: Snapshot = {
		capture() {
			return {
				match,
				replay
			};
		},
		restore(snapshot) {
			match = snapshot.match;
			replay = snapshot.replay;
		}
	};
</script>

<ButtonBack onclick={() => goto('/')}>Back to Dashboard</ButtonBack>

{#key match}
	{#if match}
		<Lobby.Root lobby={match}>
			<div class="mb-6 grid grid-cols-[250px_auto] gap-8">
				<Lobby.Map />
				<div class="py-2">
					<Lobby.Mapname level="2" class="mb-4" />
					<Lobby.Details />
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				{#each match.players as player}
					{@const stats = getLeaderboardStatsForPlayerByMatchType(match.matchType, player)}
					{@const race = player.race}

					<Player.Root {player} {stats} {race}>
						<div>
							<div
								class={cn(
									'bg-secondary-950/40 border-secondary-900 rounded-lg border',
									'grid grid-cols-[175px_auto] overflow-clip',
									player.playerId === match.me?.playerId && 'border-blue-500'
								)}
							>
								<Player.Avatar />
								<div class="flex flex-col">
									<div class="border-secondary-800 flex grow items-center gap-4 border-b p-4">
										<Player.Faction />
										<Player.Alias class="text-lg font-bold" />
										<Player.Country />
									</div>
									{#snippet cell_rank({ row }: { row: { id: number } })}
										<Player.Rank class="h-8 w-8" />
										<Player.Level />
									{/snippet}
									{#snippet cell_position({ row }: { row: { id: number } })}
										<Player.Position />
									{/snippet}
									{#snippet cell_wins({ row }: { row: { id: number } })}
										<Player.Wins />
									{/snippet}
									{#snippet cell_losses({ row }: { row: { id: number } })}
										<Player.Losses />
									{/snippet}
									<DataTable
										class="my-2 rounded-none border-none"
										headerClass="bg-transparent"
										headerRowClass="h-9 bg-transparent"
										bodyRowClass="h-9 bg-transparent odd:bg-transparent"
										data={[{ id: player.playerId }]}
										columns={playerStatsColumns}
										rowKey={(row) => row.id}
										cells={{
											rank: cell_rank,
											position: cell_position,
											wins: cell_wins,
											losses: cell_losses
										}}
									/>
								</div>
							</div>
						</div>
					</Player.Root>
				{/each}
			</div>
		</Lobby.Root>
	{/if}
{/key}
