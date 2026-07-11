<script lang="ts">
	import Side from './components/Side.svelte';
	import { getPlayerCount, isOverlayMessage, prepareLobbyData } from './lib/lobby';
	import { connectLobby } from './lib/socket';
	import type { LobbyData } from './lib/types';

	let lobbyData = $state<LobbyData | null>(null);

	connectLobby((payload) => {
		if (!isOverlayMessage(payload)) {
			return;
		}

		if (payload.type === 'message' && payload.topic === 'game.lobby.destroyed') {
			lobbyData = null;
			return;
		}

		if (payload.type === 'message' && payload.topic === 'game.lobby.started') {
			lobbyData = prepareLobbyData(payload.data);
		}
	});

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
