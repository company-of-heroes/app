<script lang="ts">
	import * as Accordion from '$lib/components/ui/accordion';
	import { app } from '$core/app';
	import { Lobby } from '.';
</script>

<span class="text-2xl font-bold">Games played today</span>
{#if app.game.playedLobbies.length}
	<div class="mt-4">
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
	</div>
{:else}
	<p class="text-secondary-400">No games played today.</p>
{/if}
