<script lang="ts">
	import type { LobbyFilters } from '$core/app/database/lobbies';
	import * as Player from '$lib/components/player';
	import * as Lobby from '$lib/components/lobby';
	import { app } from '$core/app';
	import { H } from '$lib/components/ui/h';
	import { getMapImageFromName } from '$lib/utils/game';
	import { resource } from 'runed';
	import { normalizeMapName } from '$lib/utils';
	import { groupBy, upperCase, values } from 'lodash-es';
	import { Lobby as CoHLobby } from '$core/company-of-heroes';

	let filters = $state<LobbyFilters>({
		createdAfter: undefined,
		createdBefore: undefined,
		map: undefined,
		matchType: undefined,
		createdDate: undefined,
		isRanked: undefined,
		outcome: undefined,
		playerName: undefined,
		searchTerm: undefined,
		sessionId: undefined
	});
	//let lobbies = $derived(await app.database.lobbies.filter(filters));

	const lobbies = resource(
		() => filters,
		() => app.database.lobbies.getList(filters, { limit: 1 })
	);

	$inspect(lobbies.current?.[0]);
</script>

<!-- <H level="1">History</H>
{#if lobbies.current}
	<div class="grid gap-4">
		{#each lobbies.current as l}
			{@const lobby = new CoHLobby(l.map, l.players, l.matchType)}
			<Lobby.Root
				{lobby}
				class="grid grid-cols-[200px_auto] gap-6 rounded-lg border border-gray-700 bg-gray-800 p-4"
			>
				<Lobby.Map />
				<div class="py-2">
					<div class="mb-4 text-xl font-bold">{lobby.mapName}</div>
					<div class="grid grid-cols-2 gap-4">
						{#each lobby.teams as team, index (team.teamId)}
							<div>
								<div class="rounded-md border border-gray-600 bg-gray-700 px-4 py-2">
									Team {index + 1}
								</div>
								{#each team.players as player}
									<Player.Root
										{player}
										class="grid grid-cols-[30px_auto_50px_50px] items-center gap-2 px-4 *:py-2"
									>
										<Player.Rank />
										<Player.Country />
										<Player.Alias />
										<Player.Wins />
										<Player.Losses />
									</Player.Root>
								{/each}
							</div>
						{/each}
					</div>
				</div>
			</Lobby.Root>
		{/each}
	</div>
{/if} -->
