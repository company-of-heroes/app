<script lang="ts">
	import * as Accordion from '$lib/components/ui/accordion';
	import { app } from '$lib/state/app.svelte';
	import { Lobby } from '.';
</script>

<h3 class="text-2xl font-bold">Games played today</h3>
<Accordion.Root>
	{#each app.game.playedLobbies as lobby, index}
		<Accordion.Item value={`${lobby.mapName}-${index}`}>
			{#snippet header()}
				<Lobby {lobby} />
			{/snippet}
			Dis is content
		</Accordion.Item>
	{/each}
</Accordion.Root>
