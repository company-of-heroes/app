<script lang="ts">
	import type { LiveLobby } from '$core/app/database/lobbies-live';
	import LobbyPlayersGrid from './lobby-players-grid.svelte';
	import { getLiveLobbyMatchType } from './dashboard-utils';

	type Props = {
		lobby: LiveLobby;
	};

	let { lobby }: Props = $props();

	const matchType = $derived(getLiveLobbyMatchType(lobby.players, lobby.isRanked));
</script>

<LobbyPlayersGrid players={lobby.players ?? []} {matchType} />
