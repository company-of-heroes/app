<script lang="ts">
	import * as Lobby from '$lib/components/lobby';
	import { H } from '../ui/h';
	import { app } from '$core/context';
	import { Alert } from '../ui/alert';
</script>

{#if !app.lobby}
	<Alert variant="warning">
		You are currently not in a game lobby. When you are in a match, the details will be displayed
		here.
	</Alert>
{:else}
	<Lobby.Root lobby={app.lobby}>
		<H level="2" class="mb-4">
			<Lobby.Mapname level="2" />
		</H>
		<div class="grid grid-cols-[200px_auto] gap-6">
			<Lobby.Map />
			<div>
				<Lobby.Players />
			</div>
		</div>
	</Lobby.Root>
{/if}
