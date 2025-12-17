import type { HelixCustomReward } from '@twurple/api';
import type { EventSubChannelRedemptionAddEvent, EventSubSubscription } from '@twurple/eventsub';
import type { TTSVoice } from '$features/twitch/tts/providers/provider.svelte';
import { Feature } from '../feature.svelte';
import { tts, twitch } from '$features/twitch';
import { watch } from 'runed';
import { app } from '$core/app';
import { error } from '@tauri-apps/plugin-log';
import { debounce } from 'lodash-es';
import PersonalVoicesPlugin from './personal-voices-plugin.svelte';

export type ProviderVoiceSettings = {
	voices: string[];
	rewardedVoices: Record<string, string>;
};

export type TTSPersonalVoicesSettings = {
	cost: number;
	providers: Record<string, ProviderVoiceSettings>;
};

export class TTSPersonalVoices extends Feature<TTSPersonalVoicesSettings> {
	name = 'tts-personal-voices';

	rewards: HelixCustomReward[] = $state([]);

	voices = $derived.by(() => {
		return tts.provider.voices.filter((v) =>
			this.settings.providers[tts.provider.name].voices.includes(v.voiceId)
		);
	});

	rewardedVoices = $derived.by(() => {
		return this.settings.providers[tts.provider.name].rewardedVoices;
	});

	private eventSubscription: EventSubSubscription | null = null;

	constructor() {
		super();
		tts.addComponent(PersonalVoicesPlugin);
	}

	async enable() {
		// Intercept speak events from the TTS service and override the
		// voiceId for a user if they have a personal voice assigned.
		tts.on('speak', (options) => {
			console.log(options);
			const userVoiceId = this.getUserVoice(options.user);
			console.log(userVoiceId);
			if (userVoiceId) {
				options.voiceId = userVoiceId;
			}
		});

		// Chat command handler: `!preview` to play a sample, `!voices` to list
		// available voices. We keep this handler lightweight and synchronous.
		twitch.on('chat-message', ({ channel, user, message, msg }) => {
			if (message.startsWith('!preview')) {
				const args = message.split(' ').slice(1);

				// `!preview` must include a voice name; show usage if absent.
				if (args.length === 0) {
					return twitch.chatClient?.say(channel, `Usage: !preview <voice name>`);
				}

				const voice = tts.provider.voices.find(
					(v) => v.name.toLowerCase() === args.join(' ').toLowerCase()
				);

				// If we couldn't find the voice by name reply with guidance.
				if (!voice) {
					return twitch.chatClient?.say(
						channel,
						`Voice "${args.join(' ')}" not found. Use !voices to see the list of available voices.`
					);
				}

				// Trigger a short preview via the TTS provider.
				tts.speak({
					message: `This is a preview of the ${voice.name} voice. Hello ${user}! I hope you like my sound.`,
					voiceId: voice.voiceId,
					user
				});
			}

			if (message.startsWith('!voices')) {
				// Build and send a short list of voice names available for
				// personal unlocks. We add a marker for the default voice.
				const voiceList = this.voices
					.map((v) => `${v.name}${v.voiceId === tts.provider.defaultVoiceId ? ' (default)' : ''}`)
					.join(' | ');
				twitch.chatClient?.say(channel, `Available voices: ${voiceList}`);
			}
		});

		// When settings.voices changes, regenerate channel point rewards
		// so the channel owner can enable/disable which voices are purchasable.
		watch(
			() => [this.settings.providers[tts.provider.name].voices, this.settings.cost],
			debounce(() => {
				this.updateRewards();
			}, 1000)
		);

		// Listen for the Twitch token loading; this means a channel is authenticated.
		// Once we have a token we can attach an EventSub handler to react when a
		// channel points redemption matching a personal voice is used.
		watch(
			() => twitch.token,
			() => {
				if (!twitch.token) {
					return;
				}

				if (!twitch.eventSub) {
					return;
				}

				// Create an event subscription that reacts to the channel's
				// redemption of any 'PERSONALITY' reward. The reward title stores
				// the voice name in the channel reward text.
				this.eventSubscription = twitch.eventSub.onChannelRedemptionAdd(
					twitch.token.userId,
					async (event) => {
						if (event.rewardTitle.startsWith('[PERSONALITY]')) {
							const voiceName = event.rewardTitle.replace('[PERSONALITY]', '').trim();
							const voice = tts.provider.voices.find((v) => v.name === voiceName);

							// If the voice can't be resolved, refund the channel
							// points and inform the user.
							if (!voice) {
								return this.refundFailedReward(event, event.rewardId, event.id);
							}

							// Assign the voice to the user who redeemed the
							// reward.
							this.rewardVoiceToUser(voice, event.userDisplayName);
						}
					}
				);
			}
		);
	}

	/**
	 * Refresh channel point rewards so the set of personal voice rewards
	 * is replaced by the current `settings.voices` selection.
	 */
	async updateRewards() {
		if (!twitch.client) {
			return;
		}

		this.getChannelRewards()
			.then(() => this.removeChannelRewards())
			.then(() => this.createChannelRewards());
	}

	/**
	 * Load existing channel point rewards and filter for personal voice rewards.
	 */
	async getChannelRewards() {
		if (!twitch.client) {
			return;
		}

		this.rewards = await twitch.client.channelPoints
			.getCustomRewards(twitch.token!.userId, true)
			.then((rewards) => {
				return rewards.filter((reward) => reward.title.startsWith('[PERSONALITY]'));
			});
	}

	/**
	 * Removes the currently cached personal voice rewards from the channel so
	 * they can be freshly recreated. This is done serially to avoid throttling.
	 */
	async removeChannelRewards() {
		if (!twitch.client) {
			return;
		}

		for await (const reward of this.rewards) {
			await twitch.client.channelPoints.deleteCustomReward(twitch.token!.userId, reward.id);
		}
	}

	/**
	 * Create channel point rewards for each configured personal voice. The
	 * reward title encodes the name so we can look it up on redemption.
	 */
	async createChannelRewards() {
		for await (const voiceId of this.settings.providers[tts.provider.name].voices) {
			const voice = tts.provider.voices.find((v) => v.voiceId === voiceId);

			if (!voice) {
				continue;
			}

			await twitch.client?.channelPoints
				.createCustomReward(twitch.token!.userId, {
					title: `[PERSONALITY] ${voice.name!.length > 25 ? voice.name!.substring(0, 25) + '...' : voice.name!}`,
					cost: this.settings.cost,
					prompt: `!preview ${voice.name} to hear a sample of this voice.`,
					isEnabled: true,
					backgroundColor: '#9146FF',
					autoFulfill: false
				})
				.catch((err) => {
					error(`Failed to create reward for personal voice ${voice.name}: ${JSON.stringify(err)}`);
					app.toast.error(
						`Failed to create reward for personal voice ${voice.name}. See logs for details. ${JSON.stringify(err)}`,
						{ duration: 10000 }
					);
				});
		}
	}

	rewardVoiceToUser(voice: TTSVoice, user: string, notify: boolean = true) {
		// Persist the voice assignment for the user so all their future
		// messages will be spoken with the personal voice.
		this.settings.providers[tts.provider.name].rewardedVoices[user.toLowerCase()] = voice.voiceId;

		// Announce the assignment in chat for user feedback.
		if (notify) {
			twitch.chatClient?.say(
				twitch.token!.userName!,
				`@${user}, you unlocked ${voice.name}. Your messages will now be spoken using this voice!`
			);
		}
	}

	refundFailedReward(
		event: EventSubChannelRedemptionAddEvent,
		rewardId: string,
		redemptionId: string
	) {
		// If a reward is redeemed for a voice that cannot be found, we inform
		// the redeemer in chat and cancel (refund) the redemption via Twitch API.
		twitch.chatClient?.say(
			twitch.token!.userName!,
			`@${event.userDisplayName}, the voice associated with this reward could not be found. Please contact the channel owner. Your channel points have been refunded.`
		);

		// Use the API to cancel (refund) the redemption so the user recovers
		// their channel points.
		twitch.client?.channelPoints.updateRedemptionStatusByIds(
			twitch.token!.userId,
			rewardId,
			[redemptionId],
			'CANCELED'
		);
	}

	getUserVoice(user: string): string | null {
		// Return the voice id for a user or null if none is assigned. This is
		// used by the TTS 'speak' handler to override voice selection.
		return this.settings.providers[tts.provider.name].rewardedVoices[user] || null;
	}

	async disable() {
		if (this.eventSubscription) {
			this.eventSubscription.stop();
		}

		// Clear any subscriptions and remove personal voice rewards on disable.
		this.eventSubscription = null;

		if (twitch.token) {
			this.getChannelRewards().then(() => this.removeChannelRewards());
		}
	}

	defaultSettings() {
		return {
			cost: 15000,
			providers: tts.providers.reduce(
				(acc, provider) => {
					acc[provider.name] = {
						voices: [],
						rewardedVoices: {}
					};
					return acc;
				},
				{} as Record<string, ProviderVoiceSettings>
			)
		};
	}
}

export const ttsPersonalVoices = new TTSPersonalVoices();
