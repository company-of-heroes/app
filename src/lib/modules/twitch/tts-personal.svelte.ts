import { app } from '$core/app';
import type { HelixCustomReward } from '@twurple/api';
import type { EventSubSubscription } from '@twurple/eventsub';
import type { Twitch } from './twitch.svelte';
import { watch } from 'runed';
import { Bootable } from '../bootable.svelte';

export class TTSPersonal extends Bootable {
	enabled = $derived(app.settings.twitch?.personalVoicesEnabled ?? false);
	/**
	 * The list of personal voices available for TTS.
	 * This is derived from the application settings.
	 *
	 * @public
	 * @type {string[]}
	 */
	voices = $derived(app.settings.twitch?.personalVoices ?? []);
	/**
	 * The Twitch instance used for interacting with the Twitch API.
	 * This is derived from the active modules in the application.
	 *
	 * @public
	 * @type {Twitch}
	 */
	rewards: HelixCustomReward[] = $state([]);
	/**
	 * The active voices for each user.
	 * This is a reactive state that updates based on channel reward redemptions.
	 *
	 * @public
	 * @type {Record<string, string>}
	 */
	activeVoices: Record<string, string> = $state({});
	/**
	 * The Twitch instance used for interacting with the Twitch API.
	 * This is derived from the active modules in the application.
	 *
	 * @public
	 * @type {Twitch}
	 */
	twitch: Twitch = $derived(app.activeModules.get('twitch') as Twitch);
	/**
	 * Subscriptions for EventSub events related to channel rewards.
	 * This is used to listen for reward add and remove events.
	 *
	 * @private
	 * @type {EventSubSubscription[]}
	 */
	subscriptions: EventSubSubscription[] = $state([]);
	/**
	 * Initializes the TTSPersonal module.
	 * This method sets up the necessary subscriptions and fetches initial rewards.
	 *
	 * @override
	 */
	cleanup: undefined | (() => void) = undefined;

	/**
	 * Initializes the TTSPersonal module.
	 * This method sets up the necessary subscriptions and fetches initial rewards.
	 *
	 * @override
	 */
	async init() {
		this.createRewardSubscriptions();

		await this.getActiveVoices();
		await this.getRewards();
		await this.removeChannelRewards();

		this.cleanup = $effect.root(() => {
			watch(
				() => this.twitch.settings.personalVoices,
				() => this.updateChannelRewards() as never
			);
			watch(
				() => this.activeVoices,
				() => app.store.set('activeVoices', this.activeVoices) as never
			);
		});

		this.isLoaded = true;
	}

	/**
	 * Fetches the active voices from the application store.
	 * This method initializes the activeVoices state with the stored values.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	private async getActiveVoices() {
		this.activeVoices = (await app.store.get('activeVoices')) || {};
	}

	/**
	 * Creates subscriptions for channel reward add and remove events.
	 * This allows the module to react to changes in channel rewards.
	 *
	 * @private
	 */
	private createRewardSubscriptions() {
		const onChannelRedemptionAdd = this.twitch.eventSub!.onChannelRewardAdd(
			this.twitch.user!.userId!,
			() => {
				this.getRewards();
			}
		);
		const onChannelRewardRemove = this.twitch.eventSub!.onChannelRewardRemove(
			this.twitch.user!.userId!,
			() => {
				this.getRewards();
			}
		);

		this.subscriptions.push(onChannelRedemptionAdd, onChannelRewardRemove);
	}

	/**
	 * Fetches the current channel rewards and updates the rewards state.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	async getRewards() {
		this.rewards = await this.twitch.client!.channelPoints.getCustomRewards(
			this.twitch.user!.userId!,
			true
		);
	}

	/**
	 * Updates channel rewards based on the current personal voices.
	 * This method creates or updates custom rewards for each voice in the personal voices list.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	private async updateChannelRewards() {
		for (let voice of this.voices) {
			if (voice === 'Ika') {
				voice = 'DexN';
			}

			this.twitch.client!.channelPoints.createCustomReward(this.twitch.user!.userId!, {
				title: `[PERSONALITY] ${voice.length > 25 ? voice.substring(0, 25) + '...' : voice}`,
				cost: 20000,
				backgroundColor: '#c10000',
				prompt: `${voice} will be your personality during live streams. All messages you send will be read in this voice. Preview voices at https://fknoobs.com/`,
				autoFulfill: true,
				maxRedemptionsPerStream: 1,
				maxRedemptionsPerUserPerStream: 1
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
				this.twitch.user!.userId!,
				reward.id
			);
		}
	}

	/**
	 * Listens for channel reward redemptions and updates active voices.
	 *
	 * @private
	 */
	listenForRewardRedemption() {
		const onChannelRedemptionAdd = this.twitch.eventSub!.onChannelRedemptionAdd(
			this.twitch.user!.userId!,
			async (reward) => {
				if (reward.rewardTitle.startsWith('[PERSONALITY]')) {
					let voice = reward.rewardTitle.replace('[PERSONALITY] ', '');

					if (voice === 'DexN') {
						voice = 'Ika';
					}

					this.activeVoices[reward.userName] = voice;
					app.store.set('activeVoices', this.activeVoices);
				}
			}
		);

		this.subscriptions.push(onChannelRedemptionAdd);
	}

	/**
	 * Cleans up the module.
	 * This method is called when the module is disabled or destroyed.
	 * It removes all channel rewards and stops all subscriptions.
	 *
	 * @override
	 */
	destroy(): void {
		this.removeChannelRewards?.();
		this.cleanup?.();
		this.isLoaded = false;

		this.subscriptions.forEach((subscription) => subscription.stop());
	}
}
