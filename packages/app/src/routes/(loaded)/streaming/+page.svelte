<script lang="ts">
	import { twitch } from '$features/twitch';
	import { youtube } from '$features/youtube';
	import { streamingHours } from '$features/streaming';
	import { app } from '$core/app/context';
	import * as Tabs from '$lib/components/ui/tabs';
	import { StreamerBadgeProgress } from '@company-of-heroes/ui/player';
	import { TtsTab } from './tabs/tts-tab';
	import TwitchTab from './tabs/twitch-tab/twitch-tab.svelte';
	import { YoutubeTab } from './tabs/youtube-tab';
	import { OverlaysTab } from './tabs/overlays-tab';
	import { BotTab } from './tabs/bot-tab';
	import { useI18n } from '$lib/i18n';
	import { watch } from 'runed';

	const STREAMER_HOURS = 12;
	const STREAMER_MINUTES = STREAMER_HOURS * 60;
	const HOUR_MS = 60 * 60 * 1000;

	let currentTab = $state('twitch');
	const { t } = useI18n();

	const chatEnabled = $derived(twitch.enabled || youtube.enabled);
	const streamedHours = $derived(Math.min(streamingHours.streamedMs / HOUR_MS, STREAMER_HOURS));
	const streamedMinutes = $derived(streamedHours * 60);
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
		<StreamerBadgeProgress
			hours={streamedHours}
			total={STREAMER_HOURS}
			granted={badgeGranted}
			title={t('Streamer badge')}
			description={badgeGranted
				? t(
						'Your purple Streamer badge shows next to your name in lobbies, leaderboards, comments and replays.'
					)
				: t(
						'Stream {hours} hours of Company of Heroes to earn a purple Streamer badge. It shows next to your name in lobbies, leaderboards, comments and replays, so viewers and other players know you go live.',
						{ hours: STREAMER_HOURS }
					)}
			valueLabel={t('{current} / {total} min', {
				current: Math.floor(streamedMinutes),
				total: STREAMER_MINUTES
			})}
			remainingLabel={t('{minutes} min to go', {
				minutes: Math.ceil(STREAMER_MINUTES - streamedMinutes)
			})}
			unlockedLabel={t('Unlocked')}
		/>
	</div>
{/if}
<div class="border-secondary-900 overflow-clip border-b">
	<Tabs.Root bind:value={currentTab}>
		<Tabs.List class="px-4">
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
