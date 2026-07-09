<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs';
	import ReplayPlayers from './replay-players.svelte';
	import ReplayChat from './replay-chat.svelte';
	import ReplayActions from './replay-actions.svelte';
</script>

<Tabs.Root value="overview">
	<Tabs.List>
		<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
		<Tabs.Trigger value="chat">Chat</Tabs.Trigger>
		<Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
	</Tabs.List>
	<Tabs.Content value="overview" class="flex grow flex-col gap-4">
		<ReplayPlayers />
	</Tabs.Content>
	<Tabs.Content value="chat" class="flex grow flex-col gap-4">
		<ReplayChat class="grow" />
	</Tabs.Content>
	<Tabs.Content value="timeline" class="flex grow flex-col gap-4">
		<ReplayActions />
	</Tabs.Content>
</Tabs.Root>
