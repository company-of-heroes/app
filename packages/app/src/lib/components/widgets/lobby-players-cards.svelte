<script lang="ts">
	import type { LobbyPlayer } from '@fknoobs/app';
	import type { MatchTypeId } from '$core/game/lobby';
	import { sortBy } from 'lodash-es';
	import LobbyPlayerCard from './lobby-player-card.svelte';
	import { getAlliesPlayers, getAxisPlayers } from './dashboard-utils';

	type Props = {
		players: LobbyPlayer[];
		matchType: MatchTypeId;
		highlightPlayerId?: number;
	};

	let { players, matchType, highlightPlayerId }: Props = $props();

	const allies = $derived(sortBy(getAlliesPlayers(players), 'index'));
	const axis = $derived(sortBy(getAxisPlayers(players), 'index'));
</script>

<div class="grid grid-cols-1 gap-8 xl:grid-cols-2">
	<section>
		<h3 class="text-secondary-400 mb-4 text-xs font-semibold tracking-wide uppercase">Allies</h3>
		<div class="grid gap-3">
			{#each allies as player (player.index)}
				<LobbyPlayerCard
					{player}
					{matchType}
					isMe={highlightPlayerId !== undefined && player.playerId === highlightPlayerId}
				/>
			{/each}
		</div>
	</section>
	<section>
		<h3 class="text-secondary-400 mb-4 text-xs font-semibold tracking-wide uppercase">Axis</h3>
		<div class="grid gap-3">
			{#each axis as player (player.index)}
				<LobbyPlayerCard
					{player}
					{matchType}
					isMe={highlightPlayerId !== undefined && player.playerId === highlightPlayerId}
				/>
			{/each}
		</div>
	</section>
</div>
