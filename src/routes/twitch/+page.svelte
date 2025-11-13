<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs';
	import { H } from '$lib/components/ui/h';
	import { app } from '$core/app';
	import TwitchTab from './tabs/twitch-tab.svelte';
	import TtsTab from './tabs/tts-tab.svelte';

	$inspect(app.settings.twitch.enabled);
</script>

<H level="1">Twitch</H>
<Tabs.Root value="tts">
	<Tabs.List>
		<Tabs.Trigger value="twitch">Twitch</Tabs.Trigger>
		<Tabs.Trigger value="tts" disabled={!app.settings.twitch.enabled}>TTS</Tabs.Trigger>
		<Tabs.Trigger value="predictions" disabled={!app.settings.twitch.enabled}>
			Predictions
		</Tabs.Trigger>
		<Tabs.Trigger value="overlays" disabled={!app.settings.twitch.enabled}>Overlays</Tabs.Trigger>
	</Tabs.List>
	<Tabs.Content value="twitch">
		<TwitchTab />
	</Tabs.Content>
	<Tabs.Content value="tts">
		<TtsTab />
	</Tabs.Content>
</Tabs.Root>
