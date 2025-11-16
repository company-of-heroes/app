import { Module } from '$lib/modules/module.svelte';
import { watch } from 'runed';
import { app } from '../app.svelte';
import type { HelixCustomReward } from '@twurple/api';
import { debug } from '@tauri-apps/plugin-log';
import type { EventSubSubscription } from '@twurple/eventsub';

export class TTSPersonalVoices extends Module {
	enabled = $derived(app.settings.twitch.tts.personalVoices.enabled);

	voices = $derived.by(() => {
		return (
			app.modules
				.get('twitch')
				.tts?.elevenlabs?.voices.filter((v) =>
					app.settings.twitch.tts.personalVoices.voices.includes(v.voiceId)
				) || []
		);
	});

	twitch = $derived(app.modules.get('twitch'));

	rewards: HelixCustomReward[] = $state([]);

	cleanup: undefined | (() => void) = undefined;

	/**
	 * Subscriptions for EventSub events related to channel rewards.
	 * This is used to listen for reward add and remove events.
	 *
	 * @private
	 * @type {EventSubSubscription[]}
	 */
	subscriptions: EventSubSubscription[] = $state([]);

	async init() {
		await this.getRewards();
		await this.removeChannelRewards();
		await this.listenForRewardRedemption();

		this.cleanup = $effect.root(() => {
			watch(
				() => [this.voices, app.settings.twitch.tts.personalVoices.rewardCost],
				() => {
					this.removeChannelRewards().then(() => this.createChannelRewards());
				}
			);
		});
	}

	/**
	 * Fetches the current channel rewards and updates the rewards state.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	async getRewards() {
		this.rewards = await this.twitch.client!.channelPoints.getCustomRewards(
			this.twitch.tokenInfo!.userId!,
			true
		);
	}

	/**
	 * Creates channel rewards for each personal voice.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	private async createChannelRewards() {
		for await (const voice of this.voices) {
			this.twitch.client?.channelPoints
				.createCustomReward(this.twitch.tokenInfo!.userId!, {
					title: `[PERSONALITY] ${voice.name!.length > 25 ? voice.name!.substring(0, 25) + '...' : voice.name!}`,
					cost: app.settings.twitch.tts.personalVoices.rewardCost,
					prompt: `!preview ${voice.voiceId} to hear a sample of this voice.`,
					isEnabled: true,
					backgroundColor: '#9146FF',
					autoFulfill: true
				})
				.then(() => {
					debug(`Created reward for personal voice: ${voice.name}`);
				})
				.catch((err) => {
					debug(
						`Failed to create reward for personal voice: ${voice.name}. Error: ${JSON.stringify(err)}`
					);
				});
		}
	}

	/**
	 * Removes existing channel rewards that start with '[PERSONALITY]'.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	private async removeChannelRewards() {
		const existingRewards = this.rewards.filter((reward) =>
			reward.title.startsWith('[PERSONALITY]')
		);

		for (const reward of existingRewards) {
			await this.twitch.client!.channelPoints.deleteCustomReward(
				this.twitch.tokenInfo!.userId!,
				reward.id
			);
		}
	}

	/**
	 * Listens for channel reward redemptions and updates active voices.
	 *
	 * @private
	 */
	private listenForRewardRedemption() {
		const onChannelRedemptionAdd = this.twitch.eventSub!.onChannelRedemptionAdd(
			this.twitch.tokenInfo!.userId!,
			async (reward) => {
				if (reward.rewardTitle.startsWith('[PERSONALITY]')) {
					let voice = this.voices.find(
						(v) => v.name === reward.rewardTitle.replace('[PERSONALITY] ', '')
					);
					let exists = app.settings.twitch.tts.personalVoices.rewardedVoices.find(
						(rv) => rv.user === reward.userName
					);

					if (!voice) {
						return;
					}

					if (exists) {
						app.settings.twitch.tts.personalVoices.rewardedVoices =
							app.settings.twitch.tts.personalVoices.rewardedVoices.filter(
								(rv) => rv.user !== reward.userName
							);
					}

					app.settings.twitch.tts.personalVoices.rewardedVoices.push({
						user: reward.userName,
						voiceId: voice.voiceId
					});
				}
			}
		);

		this.subscriptions.push(onChannelRedemptionAdd);
	}

	async destroy() {
		if (this.cleanup) {
			this.cleanup();
		}

		await this.getRewards();
		this.cleanup = undefined;
		this.removeChannelRewards();
	}
}
