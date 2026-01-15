<script lang="ts">
	import * as Lobby from '$lib/components/lobby';
	import * as Player from '$lib/components/player';
	import * as Table from '$lib/components/ui/table';
	import { app } from '$core/app/context';
	import { cn } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import { ButtonBack } from '$lib/components/ui/button';
	import { goto } from '$app/navigation';
</script>

<ButtonBack onclick={() => goto('/')}>Back to Dashboard</ButtonBack>

{#if app.lobby}
	<Lobby.Root lobby={app.lobby}>
		<div class="mb-6 grid grid-cols-[250px_auto] gap-8">
			<Lobby.Map />
			<div class="py-2">
				<Lobby.Mapname level="2" class="mb-4" />
				<Lobby.Details />
			</div>
		</div>
		<div class="grid grid-cols-2 gap-4">
			{#each app.lobby.players as player}
				{@const stats = getLeaderboardStatsForPlayerByMatchType(app.lobby.matchType, player)}
				{@const race = player.race}

				<Player.Root {player} {stats} {race}>
					<div>
						<div
							class={cn(
								'bg-secondary-950/40 border-secondary-900 rounded-lg border',
								'grid grid-cols-[175px_auto] overflow-clip',
								player.playerId === app.lobby.me.playerId && 'border-blue-500'
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
