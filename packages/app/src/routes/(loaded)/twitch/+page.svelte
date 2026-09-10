<script lang="ts">
	import { twitch } from '$features/twitch';
	import * as Tabs from '$lib/components/ui/tabs';
	import { TtsTab } from './tabs/tts-tab';
	import TwitchTab from './tabs/twitch-tab/twitch-tab.svelte';
	import { OverlaysTab } from './tabs/overlays-tab';
	import { BotTab } from './tabs/bot-tab';
	import { useI18n } from '$lib/i18n';
	import { watch } from 'runed';

	let currentTab = $state('twitch');
	const { t } = useI18n();

	watch(
		() => twitch.enabled,
		(enabled) => {
			if (!enabled && (currentTab === 'tts' || currentTab === 'bot')) {
				currentTab = 'twitch';
			}
		}
	);
</script>

<div class="border-secondary-900 overflow-clip border-b">
	<Tabs.Root bind:value={currentTab}>
		<Tabs.List class="px-4 py-2">
			<Tabs.Trigger value="twitch">{t('Twitch')}</Tabs.Trigger>
			<Tabs.Trigger value="tts" disabled={!twitch.enabled}>{t('TTS')}</Tabs.Trigger>
			<Tabs.Trigger value="bot" disabled={!twitch.enabled}>{t('Bot')}</Tabs.Trigger>
			<Tabs.Trigger value="overlays">{t('Overlays')}</Tabs.Trigger>
		</Tabs.List>
		<div class="border-secondary-800 border-t">
			<Tabs.Content value="twitch">
				<TwitchTab />
			</Tabs.Content>
			<Tabs.Content value="tts">
				<TtsTab />
			</Tabs.Content>
			<Tabs.Content value="bot">
				<BotTab />
			</Tabs.Content>
			<Tabs.Content value="overlays">
				<OverlaysTab />
			</Tabs.Content>
		</div>
	</Tabs.Root>
</div>
