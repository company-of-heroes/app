<script lang="ts">
	import * as Lobby from '$lib/components/lobby';
	import { app } from '$core/app/context';
	import { Button } from '$lib/components/ui/button';
	import { H } from '$lib/components/ui/h';

	const lobby = $derived(app.lobby);
</script>

{#if lobby}
	<div>
		<H level="2" class="mb-4">Current game</H>
		<Lobby.Root {lobby}>
			<div class="mb-6 grid grid-cols-[250px_auto] gap-8">
				<Lobby.Map />
				<div class="py-2">
					<Lobby.Mapname level="3" class="mb-4" />
					<Lobby.Details />
				</div>
			</div>
			<Lobby.Players />
		</Lobby.Root>
		<div class="mt-4">
			<Button href="/current-game" variant="secondary">View full match</Button>
		</div>
	</div>
{/if}
