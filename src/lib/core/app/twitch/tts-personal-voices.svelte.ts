import type { HelixCustomReward } from '@twurple/api';
import { Plugin } from '../plugin.svelte';
import { tts, twitch } from '.';
import { watch } from 'runed';
import { app } from '../app.svelte';
import { error } from '@tauri-apps/plugin-log';
import type { EventSubChannelRedemptionAddEvent, EventSubSubscription } from '@twurple/eventsub';
import type { TTSVoice } from './tts/providers/provider.svelte';

export type TTSPersonalVoicesSettings = {
	cost: number;
	voices: string[];
	rewardedVoices: Record<string, string>; // userName -> voiceId
};

export class TTSPersonalVoices extends Plugin<TTSPersonalVoicesSettings> {
	name = 'tts-personal-voices';

	rewards: HelixCustomReward[] = $state([]);

	voices = $derived.by(() => {
		return tts.provider.voices.filter((v) => this.settings.voices.includes(v.voiceId));
	});

	rewardedVoices = $derived.by(() => {
		return this.settings.rewardedVoices;
	});

	private eventSubscription: EventSubSubscription | null = null;

	async enable() {
		tts.on('speak', (options) => {
			const userVoiceId = this.getUserVoice(options.user);
			if (userVoiceId) {
				options.voiceId = userVoiceId;
			}
		});

		twitch.on('chat-message', ({ channel, user, message, msg }) => {
			if (message.startsWith('!preview')) {
				const args = message.split(' ').slice(1);

				if (args.length === 0) {
					return twitch.chatClient?.say(channel, `Usage: !preview <voice name>`);
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

				tts.speak({
					message: `This is a preview of the ${voice.name} voice. Hello ${user}! I hope you like my sound.`,
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
		});

		watch(
			() => this.settings.voices,
			() => {
				this.updateRewards();
			}
		);

		watch(
			() => twitch.token,
			() => {
				if (!twitch.token) {
					return;
				}

				if (!twitch.eventSub) {
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
	}

	async updateRewards() {
		this.getChannelRewards()
			.then(() => this.removeChannelRewards())
			.then(() => this.createChannelRewards());
	}

	async getChannelRewards() {
		this.rewards = await twitch
			.client!.channelPoints.getCustomRewards(twitch.token!.userId, true)
			.then((rewards) => {
				return rewards.filter((reward) => reward.title.startsWith('[PERSONALITY]'));
			});
	}

	async removeChannelRewards() {
		for await (const reward of this.rewards) {
			await twitch.client!.channelPoints.deleteCustomReward(twitch.token!.userId, reward.id);
		}
	}

	async createChannelRewards() {
		for await (const voiceId of this.settings.voices) {
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

	rewardVoiceToUser(voice: TTSVoice, user: string) {
		this.settings.rewardedVoices[user] = voice.voiceId;

		twitch.chatClient?.say(
			twitch.token!.userName!,
			`@${user}, you unlocked ${voice.name}. Your messages will now be spoken using this voice!`
		);
	}

	refundFailedReward(
		event: EventSubChannelRedemptionAddEvent,
		rewardId: string,
		redemptionId: string
	) {
		twitch.chatClient?.say(
			twitch.token!.userName!,
			`@${event.userDisplayName}, the voice associated with this reward could not be found. Please contact the channel owner. Your channel points have been refunded.`
		);

		twitch.client?.channelPoints.updateRedemptionStatusByIds(
			twitch.token!.userId,
			rewardId,
			[redemptionId],
			'CANCELED'
		);
	}

	getUserVoice(user: string): string | null {
		return this.settings.rewardedVoices[user] || null;
	}

	async disable() {
		if (this.eventSubscription) {
			this.eventSubscription.stop();
		}

		this.eventSubscription = null;
		this.getChannelRewards().then(() => this.removeChannelRewards());
	}

	defaultSettings(): TTSPersonalVoicesSettings {
		return {
			cost: 15000,
			voices: [],
			rewardedVoices: {}
		};
	}
}

export const ttsPersonalVoices = new TTSPersonalVoices();
