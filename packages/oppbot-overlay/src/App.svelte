<script lang="ts">
	import Side from './components/Side.svelte';
	import { getPlayerCount, prepareLobbyData } from './lib/lobby';
	import { connectLobby, getUserIdFromPath } from './lib/lobby-feed';
	import type { LobbyData } from './lib/types';

	let lobbyData = $state<LobbyData | null>(null);
	const userId = getUserIdFromPath();

	if (userId) {
		connectLobby(userId, (data) => {
			lobbyData = data ? prepareLobbyData(data) : null;
		});
	}

	const playerCount = $derived(lobbyData ? getPlayerCount(lobbyData) : 0);
</script>

{#if lobbyData?.teams}
	<div class="manifest">
		<div class="manifest__field count-{playerCount}">
			{#each lobbyData.teams as team, index (index)}
				<Side
					{team}
					{index}
					matchType={lobbyData.matchType}
					meId={lobbyData.me?.playerId}
				/>
			{/each}
		</div>
	</div>
{/if}
