<script lang="ts">
	import * as Lobby from '$lib/components/lobby';
	import { H } from '../ui/h';
	import { app } from '$core/app';
	import { Alert } from '../ui/alert';
	import { state } from './state.svelte';

	app.game.on('LOBBY:STARTED', (l) => {
		state.match = l;
	});

	app.game.on('LOBBY:DESTROYED', () => {
		state.match = null;
	});
</script>

<H level="2" class="mb-4">Current game</H>
{#key state.match}
	{#if !state.match}
		<Alert variant="warning">
			You are currently not in a game lobby. When you are in a match, the details will be displayed
			here.
		</Alert>
	{:else}
		<Lobby.Root class="grid grid-cols-[200px_auto] gap-6" lobby={state.match}>
			<Lobby.Map />
			<div class="py-4">
				<Lobby.Mapname />
				<Lobby.Players class="mt-6" />
			</div>
		</Lobby.Root>
	{/if}
{/key}
