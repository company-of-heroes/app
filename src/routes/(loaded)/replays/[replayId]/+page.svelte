<script lang="ts">
	import * as Replay from '$lib/components/replay';
	import * as Tabs from '$lib/components/ui/tabs';
	import { page } from '$app/state';
	import { app } from '$core/context';
	import { resource } from 'runed';
	import { ButtonBack } from '$lib/components/ui/button';

	let query = resource(
		() => page.params.replayId!,
		() => app.database.replays.getById(page.params.replayId!)
	);
</script>

<ButtonBack>Go back</ButtonBack>

{#if query.current}
	<Replay.Root file={query.current} class="flex grow flex-col gap-4">
		<Replay.Title class="mb-4" />
		<Replay.Details class="mb-4" />
		<Tabs.Root value="timeframe">
			<Tabs.List>
				<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
				<Tabs.Trigger value="chat">Chat</Tabs.Trigger>
				<Tabs.Trigger value="timeframe">Timeframe</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="overview" class="flex grow flex-col gap-4">
				<Replay.Players />
			</Tabs.Content>
			<Tabs.Content value="chat" class="flex grow flex-col gap-4">
				<Replay.Chat class="grow" />
			</Tabs.Content>
			<Tabs.Content value="timeframe" class="flex grow flex-col gap-4">
				<Replay.Actions />
			</Tabs.Content>
		</Tabs.Root>
	</Replay.Root>
{/if}
