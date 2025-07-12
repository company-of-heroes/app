import { app } from '$lib/state/app.svelte';
import type { HelixCustomReward } from '@twurple/api';
import type { EventSubSubscription } from '@twurple/eventsub';
import type { Twitch } from './twitch.svelte';

export class TTSPersonal {
	voices = $derived(app.settings.twitch?.personalVoices ?? []);

	rewards: HelixCustomReward[] = $state([]);

	eventSubscription: EventSubSubscription | undefined = $state();

	activeVoices: Record<string, string> = $state({});

	twitch: Twitch = $derived(app.activeModules.get('twitch') as Twitch);

	async init() {
		if (!this.twitch.user?.userId || this.twitch.settings.personalVoicesEnabled === false) {
			return;
		}

		this.rewards = await this.twitch.client!.channelPoints.getCustomRewards(
			this.twitch.user.userId,
			true
		);

		//await app.store.set('activeVoices', {});
		this.activeVoices = (await app.store.get('activeVoices')) ?? {};

		this.updateChannelRewards();
		this.listenForRewardRedemption();

		$effect.root(() => {
			$effect(() => {
				this.activeVoices;
				this.updateChannelRewards();
			});
		});

		return this;
	}

	private async updateChannelRewards() {
		const existingRewards = this.rewards.filter((reward) =>
			reward.title.startsWith('[PERSONALITY]')
		);

		/**
		 * Delete existing rewards that start with [PERSONALITY]
		 * This is to ensure that we don't have duplicates
		 */
		for (const reward of existingRewards) {
			await this.twitch.client!.channelPoints.deleteCustomReward(
				this.twitch.user!.userId!,
				reward.id
			);
		}

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

	listenForRewardRedemption() {
		this.eventSubscription = this.twitch.eventSub?.onChannelRedemptionAdd(
			this.twitch.user!.userId!,
			async (reward) => {
				if (reward.rewardTitle.startsWith('[PERSONALITY]')) {
					const voice = reward.rewardTitle.replace('[PERSONALITY] ', '');

					this.activeVoices[reward.userName] = voice;
					app.store.set('activeVoices', this.activeVoices);
				}
			}
		);
	}

	destroy(): void {
		this.eventSubscription?.stop();
	}
}
