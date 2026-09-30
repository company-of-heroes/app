<script lang="ts">
	import { twitch } from '$features/twitch';
	import { youtube } from '$features/youtube';
	import { streamingHours } from '$features/streaming';
	import { app } from '$core/app/context';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Meter } from '$lib/components/ui/meter';
	import { TtsTab } from './tabs/tts-tab';
	import TwitchTab from './tabs/twitch-tab/twitch-tab.svelte';
	import { YoutubeTab } from './tabs/youtube-tab';
	import { OverlaysTab } from './tabs/overlays-tab';
	import { BotTab } from './tabs/bot-tab';
	import { useI18n } from '$lib/i18n';
	import { watch } from 'runed';

	const STREAMER_HOURS = 12;
	const HOUR_MS = 60 * 60 * 1000;

	let currentTab = $state('twitch');
	const { t } = useI18n();

	const chatEnabled = $derived(twitch.enabled || youtube.enabled);
	const streamedHours = $derived(Math.min(streamingHours.streamedMs / HOUR_MS, STREAMER_HOURS));
	const badgeGranted = $derived(streamingHours.progress?.badgeGranted ?? false);

	watch(
		() => chatEnabled,
		(enabled) => {
			if (!enabled && (currentTab === 'tts' || currentTab === 'bot')) {
				currentTab = 'twitch';
			}
		}
	);
</script>

{#if app.account.isAuthenticated}
	<div class="border-secondary-900 border-b px-4 py-3">
		<Meter
			value={streamedHours}
			max={STREAMER_HOURS}
			label={badgeGranted
				? t('Streamer badge unlocked')
				: t('Stream {hours} hours of Company of Heroes to earn the Streamer badge', {
						hours: STREAMER_HOURS
					})}
			valueLabel={t('{current} / {total} h', {
				current: streamedHours.toFixed(1),
				total: STREAMER_HOURS
			})}
		/>
	</div>
{/if}
<div class="border-secondary-900 overflow-clip border-b">
	<Tabs.Root bind:value={currentTab}>
		<Tabs.List class="px-4 py-2">
			<Tabs.Trigger value="twitch">{t('Twitch')}</Tabs.Trigger>
			<Tabs.Trigger value="youtube">{t('YouTube')}</Tabs.Trigger>
			<Tabs.Trigger value="tts" disabled={!chatEnabled}>{t('TTS')}</Tabs.Trigger>
			<Tabs.Trigger value="bot" disabled={!chatEnabled}>{t('Bot')}</Tabs.Trigger>
			<Tabs.Trigger value="overlays">{t('Overlays')}</Tabs.Trigger>
		</Tabs.List>
		<div class="border-secondary-800 border-t">
			<Tabs.Content value="twitch">
				<TwitchTab />
			</Tabs.Content>
			<Tabs.Content value="youtube">
				<YoutubeTab />
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
