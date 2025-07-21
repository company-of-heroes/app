<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs';
	import TwitchTab from './tabs/twitch-tab.svelte';
	import TtsTab from './tabs/tts-tab.svelte';
	import PredictionsTab from './tabs/predictions-tab.svelte';
	import OverlaysTab from './tabs/overlays-tab.svelte';
</script>

<Tabs.Root value="overlays">
	<Tabs.List>
		<Tabs.Trigger value="twitch">Twitch</Tabs.Trigger>
		<Tabs.Trigger value="tts">TTS</Tabs.Trigger>
		<Tabs.Trigger value="predictions">Predictions</Tabs.Trigger>
		<Tabs.Trigger value="overlays">Overlays</Tabs.Trigger>
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
	<Tabs.Content value="overlays">
		<OverlaysTab />
	</Tabs.Content>
</Tabs.Root>
