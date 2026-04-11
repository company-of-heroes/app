<script lang="ts">
	import type { ReplayData } from '@fknoobs/replay-parser';
	import type { Snapshot } from './$types';
	import * as Lobby from '$lib/components/lobby';
	import * as Player from '$lib/components/player';
	import * as Table from '$lib/components/ui/table';
	import { app } from '$core/app/context';
	import { cn } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import { ButtonBack } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let match = $derived(app.lobby);
	let replay = $state<{
		file: File;
		replay: ReplayData;
	} | null>(null);

	app.on('lobby.saved', (match) => {
		goto(resolve('/(loaded)/history/[id]', { id: match.id }));
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
									player.playerId === match.me.playerId && 'border-blue-500'
								)}
							>
								<Player.Avatar />
								<div class="flex flex-col">
									<div class="border-secondary-800 flex grow items-center gap-4 border-b p-4">
										<Player.Faction />
										<Player.Alias class="text-lg font-bold" />
										<Player.Country />
									</div>
									<Table.Table class="my-2 rounded-none border-none">
										<Table.Head class="bg-transparent">
											<Table.tr class="h-9 bg-transparent odd:bg-transparent">
												<Table.th
													class="text-secondary-200 text-center text-lg font-medium"
													width="6/24"
												>
													Rank
												</Table.th>
												<Table.th
													class="text-secondary-200 text-center text-lg font-medium"
													width="6/24"
												>
													Position
												</Table.th>
												<Table.th
													class="text-secondary-200 text-center text-lg font-medium"
													width="6/24"
												>
													Wins
												</Table.th>
												<Table.th
													class="text-secondary-200 text-center text-lg font-medium"
													width="6/24"
												>
													Losses
												</Table.th>
											</Table.tr>
										</Table.Head>
										<Table.tr class="h-9 bg-transparent odd:bg-transparent">
											<Table.td class="flex items-center justify-center gap-2 text-lg" width="6/24">
												<Player.Rank class="h-8 w-8" />
												<Player.Level />
											</Table.td>
											<Table.td class="text-center text-lg" width="6/24">
												<Player.Position />
											</Table.td>
											<Table.td class="text-center text-lg" width="6/24">
												<Player.Wins />
											</Table.td>
											<Table.td class="text-center text-lg" width="6/24">
												<Player.Losses />
											</Table.td>
										</Table.tr>
									</Table.Table>
								</div>
							</div>
						</div>
					</Player.Root>
				{/each}
			</div>
		</Lobby.Root>
	{/if}
{/key}
