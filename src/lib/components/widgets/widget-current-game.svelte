<script lang="ts">
	import type { Lobby as MatchLobby } from '$core/company-of-heroes';
	import * as Lobby from '$lib/components/lobby';
	import { H } from '../ui/h';
	import { app } from '$core/app';
	import { Alert } from '../ui/alert';

	let lobby: MatchLobby | null = $state(null);

	app.game.on('LOBBY:STARTED', (l) => {
		lobby = l;
	});
</script>

<H level="2" class="mb-4">Current game</H>
{#key lobby}
	{#if !lobby}
		<Alert variant="warning">
			You are currently not in a game lobby. When you are in a match, the details will be displayed
			here.
		</Alert>
	{:else}
		<Lobby.Root class="grid grid-cols-[200px_auto] gap-6" {lobby}>
			<Lobby.Map />
			<div class="py-4">
				<Lobby.Mapname />
				<Lobby.Players class="mt-6" />
			</div>
		</Lobby.Root>
	{/if}
{/key}
