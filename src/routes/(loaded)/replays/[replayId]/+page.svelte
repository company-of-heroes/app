<script lang="ts">
	import * as Replay from '$lib/components/replay';
	import { page } from '$app/state';
	import { app } from '$core/context';
	import { resource } from 'runed';
	import { ButtonBack } from '$lib/components/ui/button';

	let query = resource(
		() => page.params.replayId!,
		() => app.database.replays().getById(page.params.replayId!)
	);
</script>

<ButtonBack>Go back</ButtonBack>

{#if query.current}
	<Replay.Root file={query.current} class="flex grow flex-col gap-4">
		<Replay.Title class="mb-4" />
		<Replay.Details class="mb-4" />
		<Replay.Players />
		<Replay.Chat class="grow" />
	</Replay.Root>
{/if}
