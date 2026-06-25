import type { HelixCustomReward } from '@twurple/api';
import type { EventSubChannelRedemptionAddEvent, EventSubSubscription } from '@twurple/eventsub';
import type { TTSVoice } from '$features/twitch/tts/providers/provider.svelte';
import { Feature } from '../feature.svelte';
import { tts, twitch } from '$features/twitch';
import { watch } from 'runed';
import { app } from '$core/app/context';
import { error } from '@tauri-apps/plugin-log';
import { debounce } from 'lodash-es';
import PersonalVoicesPlugin from './personal-voices-plugin.svelte';

export type ProviderVoiceSettings = {
	voices: string[];
	rewardedVoices: Record<string, string>;
	freeVoices: string[];
	rewardedFreeVoices: Record<string, string>;
};

export type TTSPersonalVoicesSettings = {
	cost: number;
	providers: Record<string, ProviderVoiceSettings>;
	enableFreeVoices: boolean;
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

	freeVoices = $derived.by(() => {
		return tts.provider.voices.filter((v) =>
			this.settings.providers[tts.provider.name].freeVoices.includes(v.voiceId)
		);
	});

	rewardedFreeVoices = $derived.by(() => {
		return this.settings.providers[tts.provider.name].rewardedFreeVoices;
	});

	private eventSubscription: EventSubSubscription | null = null;
	private unsubscribers: (() => void)[] = [];
	private disposeWatchers: (() => void) | null = null;

	constructor() {
		super();
		tts.addComponent(PersonalVoicesPlugin);
	}

	async enable() {
		// Intercept speak events from the TTS service and override the
		// voiceId for a user if they have a personal voice assigned.
		this.unsubscribers.push(
			tts.on('speak', (options) => {
				const userVoiceId = this.getUserVoice(options.user);

				if (userVoiceId) {
					options.voiceId = userVoiceId;
				}
			})
		);

		// Chat command handler: `!preview` to play a sample, `!voices` to list
		// available voices. We keep this handler lightweight and synchronous.
		const offChat = twitch.on('chat-message', ({ channel, user, message, msg }) => {
			if (message.startsWith('!preview')) {
				const args = message.split(' ').slice(1);

				// `!preview` must include a voice name; show usage if absent.
				if (args.length === 0) {
					return twitch.chatClient?.say(channel, `Usage: !preview <voice name>`);
				}

				const voice = tts.provider.voices.find(
					(v) =>
						v.alias?.toLowerCase() === args.join(' ').toLowerCase() ||
						v.name.toLowerCase() === args.join(' ').toLowerCase()
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
					message: `This is a preview of the ${voice.name} voice. Hello ${user}! How was your day? Anything interesting happened?`,
					voiceId: voice.voiceId,
					user
				});
			}

			if (message.startsWith('!voices')) {
				const voiceList = this.voices
					.map((v) => `${v.name}${v.voiceId === tts.provider.defaultVoiceId ? ' (default)' : ''}`)
					.join(' | ');

				twitch.chatClient?.say(channel, `Available voices: ${voiceList}`);
			}

			if (message.startsWith('!freevoices')) {
				if (!this.settings.enableFreeVoices) {
					return twitch.chatClient?.say(channel, `@${user}, free voices are not enabled.`);
				}

				const voiceList = this.freeVoices.map((v) => `${v.alias ?? v.name}`).join(' | ');

				twitch.chatClient?.say(
					channel,
					`Available free voices: ${voiceList}. Use !setfreevoice <voice name> to set a free voice.`
				);
			}

			if (message.startsWith('!setfreevoice')) {
				if (!this.settings.enableFreeVoices) {
					return twitch.chatClient?.say(channel, `@${user}, free voices are not enabled.`);
				}

				const args = message.split(' ').slice(1);
				const voice = tts.provider.voices.find(
					(v) =>
						v.alias?.toLowerCase() === args.join(' ').toLowerCase() ||
						v.name.toLowerCase() === args.join(' ').toLowerCase()
				);

				if (!voice) {
					return twitch.chatClient?.say(
						channel,
						`Voice "${args.join(' ')}" not found. Use !freevoices to see the list of available free voices.`
					);
				}

				this.rewardVoiceToUser(voice, user, true, true);
			}

			if (message.startsWith('!removefreevoice')) {
				if (!this.settings.enableFreeVoices) {
					return;
				}

				this.removeFreeVoiceFromUser(user, true);
			}

			if (message.startsWith('!setvoice')) {
				if (!msg.userInfo.isSubscriber) {
					return twitch.chatClient?.say(
						channel,
						`@${user}, only subscribers can use the !setvoice command.`
					);
				}

				const args = message.split(' ').slice(1);

				// `!setvoice` must include a voice name; show usage if absent.
				if (args.length === 0) {
					return twitch.chatClient?.say(channel, `Usage: !setvoice <voice name>`);
				}

				const voice = tts.provider.voices.find(
					(v) => v.name.toLowerCase() === args.join(' ').toLowerCase()
				);

				if (!voice) {
					return twitch.chatClient?.say(
						channel,
						`Voice "${args.join(' ')}" not found. Use !voices to see the list of available voices.`
					);
				}

				this.rewardVoiceToUser(voice, user, false);
			}
		});

		this.unsubscribers.push(offChat);

		this.disposeWatchers = $effect.root(() => {
			watch(
				() => [this.settings.providers[tts.provider.name].voices, this.settings.cost],
				debounce(() => {
					this.updateRewards();
				}, 10000)
			);

			watch(
				() => twitch.token,
				() => {
					// Drop the previous redemption subscription before re-subscribing.
					this.eventSubscription?.stop();
					this.eventSubscription = null;

					if (!twitch.token || !twitch.eventSub) {
						return;
					}

					this.eventSubscription = twitch.eventSub.onChannelRedemptionAdd(
						twitch.token.userId,
						async (event) => {
							if (event.rewardTitle.startsWith('[PERSONALITY]')) {
								const voiceName = event.rewardTitle.replace('[PERSONALITY]', '').trim();
								const voice = tts.provider.voices.find((v) => v.name === voiceName);

								if (!voice) {
									return this.refundFailedReward(event, event.rewardId, event.id);
								}

								this.rewardVoiceToUser(voice, event.userDisplayName);
							}
						}
					);
				}
			);
		});
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

	rewardVoiceToUser(
		voice: TTSVoice,
		user: string,
		notify: boolean = true,
		isFree: boolean = false
	) {
		if (isFree) {
			this.settings.providers[tts.provider.name].rewardedFreeVoices[user.toLowerCase()] =
				voice.voiceId;
		} else {
			this.settings.providers[tts.provider.name].rewardedVoices[user.toLowerCase()] = voice.voiceId;
		}

		if (notify) {
			twitch.chatClient?.say(
				twitch.token!.userName!,
				`@${user}, you unlocked ${voice.alias ?? voice.name}. Your messages will now be spoken using this voice!`
			);
		}
	}

	removeFreeVoiceFromUser(user: string, notify: boolean = false) {
		delete this.settings.providers[tts.provider.name].rewardedFreeVoices[user.toLowerCase()];

		if (notify) {
			twitch.chatClient?.say(
				twitch.token!.userName!,
				`@${user}, you removed your free voice. Your messages will now be spoken using the default voice or the voice you unlocked with channel points.`
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
		return (
			this.settings.providers[tts.provider.name].rewardedFreeVoices[user] ||
			this.settings.providers[tts.provider.name].rewardedVoices[user] ||
			null
		);
	}

	async disable() {
		this.disposeWatchers?.();
		this.disposeWatchers = null;

		for (const unsubscribe of this.unsubscribers) {
			unsubscribe();
		}

		this.unsubscribers = [];

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
						rewardedVoices: {},
						freeVoices: [],
						rewardedFreeVoices: {}
					};
					return acc;
				},
				{} as Record<string, ProviderVoiceSettings>
			),
			enableFreeVoices: false
		};
	}
}

export const ttsPersonalVoices = new TTSPersonalVoices();
