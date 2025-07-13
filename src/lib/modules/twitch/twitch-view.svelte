<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs';
	import TwitchTab from './tabs/twitch-tab.svelte';
	import TtsTab from './tabs/tts-tab.svelte';
	import PredictionsTab from './tabs/predictions-tab.svelte';
</script>

<Tabs.Root value="predictions">
	<Tabs.List>
		<Tabs.Trigger value="twitch">Twitch</Tabs.Trigger>
		<Tabs.Trigger value="tts">TTS</Tabs.Trigger>
		<Tabs.Trigger value="predictions">Predictions</Tabs.Trigger>
	</Tabs.List>
	<Tabs.Content value="twitch">
		<TwitchTab />
	</Tabs.Content>
	<Tabs.Content value="tts">
		<TtsTab />
	</Tabs.Content>
	<Tabs.Content value="predictions">
		<PredictionsTab />
	</Tabs.Content>
</Tabs.Root>
