import { app } from '$core/app/context';
import { watch } from 'runed';
import { Feature } from '../feature.svelte';
import { twitch } from '../twitch/twitch.svelte';

export type TwitchBotSettings = {
	enablePlayerStats: boolean;
	messages: {
		interval: number;
		text: string;
	}[];
};

/**
 * Chat bot: periodic custom messages and player-stat announcements when a
 * match starts (only while connected and live).
 */
export class TwitchBot extends Feature<TwitchBotSettings> {
	name = 'twitch-bot';

	customMessagesIntervals: Map<number, ReturnType<typeof setInterval>> = new Map();

	#lobbySubscription: (() => void) | null = null;
	#disposeWatchers: (() => void) | null = null;

	async enable() {
		this.#disposeWatchers = $effect.root(() => {
			watch(
				() => $state.snapshot(this.settings.messages),
				() => {
					this.#clearIntervals();

					for (const [index, message] of this.settings.messages.entries()) {
						this.registerCustomMessage(index, message.text, message.interval);
					}
				}
			);

			watch(
				() => this.settings.enablePlayerStats,
				(enabled) => {
					this.#lobbySubscription?.();
					this.#lobbySubscription = null;

					if (!enabled) {
						return;
					}

					this.#lobbySubscription = app.on('lobby.started', (lobby) => {
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
		});
	}

	registerCustomMessage(index: number, text: string, interval: number) {
		if (!Number.isFinite(interval) || interval <= 0) {
			return;
		}

		const int = setInterval(() => {
			if (!twitch.isConnected || !twitch.chatClient || !twitch.token || !twitch.isLive) {
				return;
			}

			twitch.chatClient.say(twitch.token.userName!, text);
		}, interval * 1000);

		this.customMessagesIntervals.set(index, int);
	}

	#clearIntervals() {
		this.customMessagesIntervals.forEach((interval) => clearInterval(interval));
		this.customMessagesIntervals.clear();
	}

	async disable() {
		this.#disposeWatchers?.();
		this.#disposeWatchers = null;

		this.#clearIntervals();

		this.#lobbySubscription?.();
		this.#lobbySubscription = null;
	}

	defaultSettings(): TwitchBotSettings {
		return {
			enablePlayerStats: false,
			messages: []
		};
	}
}

export const twitchBot = new TwitchBot();
