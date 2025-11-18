import { app } from '$core/app/app.svelte';
import { watch } from 'runed';
import { Plugin } from '../plugin.svelte';
import { twitch } from '../twitch/twitch.svelte';
import { differenceBy } from 'lodash-es';

export type TwitchBotSettings = {
	enablePlayerStats: boolean;
	messages: {
		interval: number;
		text: string;
	}[];
};

export class TwitchBot extends Plugin<TwitchBotSettings> {
	name = 'twitch-bot';

	customMessagesIntervals: Map<number, ReturnType<typeof setInterval>> = new Map();

	lobbySubscription: (() => void) | null = null;

	async enable() {
		watch(
			() => $state.snapshot(this.settings.messages),
			() => {
				this.customMessagesIntervals.forEach((interval) => clearInterval(interval));
				this.customMessagesIntervals.clear();

				for (const [index, message] of this.settings.messages.entries()) {
					this.registerCustomMessage(index, message.text, message.interval);
				}
			}
		);

		watch(
			() => this.settings.enablePlayerStats,
			(enabled) => {
				if (!enabled) {
					if (this.lobbySubscription) {
						this.lobbySubscription();
						this.lobbySubscription = null;
					}

					return;
				}

				this.lobbySubscription = app.game.on('LOBBY:STARTED', (lobby) => {
					const message = lobby.players
						.map((player) => {
							if (!player.profile || !player.steamId) {
								return null;
							}
							return `${player.profile.alias}: https://playercard.cohstats.com/?steamid=${player.steamId}`;
						})
						.filter(Boolean)
						.join(' | ');

					if (!twitch.isConnected || !twitch.chatClient || !twitch.token || !twitch.isLive) {
						return;
					}

					twitch.chatClient.say(twitch.token.userName!, `Player Stats: ${message}`);
				});
			}
		);
	}

	registerCustomMessage(index: number, text: string, interval: number) {
		const int = setInterval(() => {
			if (!twitch.isConnected || !twitch.chatClient || !twitch.token || !twitch.isLive) {
				return;
			}

			twitch.chatClient.say(twitch.token.userName!, text);
		}, interval * 1000);

		this.customMessagesIntervals.set(index, int);
	}

	async disable() {
		this.customMessagesIntervals.forEach((interval) => clearInterval(interval));
		this.customMessagesIntervals.clear();

		if (this.lobbySubscription) {
			this.lobbySubscription();
			this.lobbySubscription = null;
		}
	}

	defaultSettings(): TwitchBotSettings {
		return {
			enablePlayerStats: false,
			messages: []
		};
	}
}

export const twitchBot = new TwitchBot();
