import type { LobbyPlayer } from '@fknoobs/app';
import type { Match } from '$core/game/lobby';
import { app } from '$core/app/context';
import { watch } from 'runed';
import { Feature } from '../feature.svelte';
import { streamChat } from '../streaming/chat';
import { t } from '$lib/i18n';

export type TwitchBotSettings = {
	enablePlayerStats: boolean;
	messages: {
		interval: number;
		text: string;
	}[];
};

const PLAYER_STATS_TIMEOUT_MS = 20_000;
const PLAYER_STATS_POLL_MS = 200;
const PLAYERCARD_URL = 'https://coh1stats.com/players/';

function playerStatsMessage(players: LobbyPlayer[]): string {
	return players
		.map((player) => {
			const alias = player.profile?.alias?.trim();
			if (!alias || !player.steamId) {
				return null;
			}

			return `${alias}: ${PLAYERCARD_URL}${player.steamId}`;
		})
		.filter(Boolean)
		.join(' | ');
}

function playerStatsPending(players: LobbyPlayer[]): boolean {
	return players.some(
		(player) => player.playerId !== -1 && (!player.steamId || !player.profile?.alias?.trim())
	);
}

/**
 * Chat bot: periodic custom messages and player-stat announcements when a
 * match starts, posted to every connected platform that is live.
 */
export class TwitchBot extends Feature<TwitchBotSettings> {
	name = 'twitch-bot';

	customMessagesIntervals: Map<number, ReturnType<typeof setInterval>> = new Map();

	#lobbySubscription: (() => void) | null = null;
	#disposeWatchers: (() => void) | null = null;
	#statsAbort: AbortController | null = null;
	#sentStatsSessionId: number | null = null;

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
					this.#resetPlayerStats();

					if (!enabled) {
						return;
					}

					this.#statsAbort = new AbortController();
					const { signal } = this.#statsAbort;

					this.#lobbySubscription = app.on('lobby.started', (lobby) => {
						void this.#announcePlayerStats(lobby, signal);
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
			if (!text.trim()) {
				return;
			}

			void streamChat.sayToLive(text);
		}, interval * 1000);

		this.customMessagesIntervals.set(index, int);
	}

	#clearIntervals() {
		this.customMessagesIntervals.forEach((interval) => clearInterval(interval));
		this.customMessagesIntervals.clear();
	}

	#resetPlayerStats() {
		this.#statsAbort?.abort();
		this.#statsAbort = null;
		this.#lobbySubscription?.();
		this.#lobbySubscription = null;
		this.#sentStatsSessionId = null;
	}

	async #announcePlayerStats(lobby: Match, signal: AbortSignal) {
		if (lobby.isReplay || this.#sentStatsSessionId === lobby.sessionId) {
			return;
		}

		const message = await this.#waitForPlayerStats(lobby, signal);
		if (!message || signal.aborted || this.#sentStatsSessionId === lobby.sessionId) {
			return;
		}

		if (streamChat.liveSinks.length === 0) {
			return;
		}

		this.#sentStatsSessionId = lobby.sessionId;
		await streamChat.sayToLive(t('Player Stats: {message}', { message }));
	}

	async #waitForPlayerStats(lobby: Match, signal: AbortSignal): Promise<string> {
		const deadline = Date.now() + PLAYER_STATS_TIMEOUT_MS;

		while (!signal.aborted && Date.now() < deadline) {
			const current = app.lobby?.sessionId === lobby.sessionId ? app.lobby : lobby;
			if (app.lobby && app.lobby.sessionId !== lobby.sessionId) {
				return '';
			}

			const message = playerStatsMessage(current.players);
			if (message && !playerStatsPending(current.players)) {
				return message;
			}

			await new Promise((resolve) => setTimeout(resolve, PLAYER_STATS_POLL_MS));
		}

		if (signal.aborted || (app.lobby && app.lobby.sessionId !== lobby.sessionId)) {
			return '';
		}

		const current = app.lobby?.sessionId === lobby.sessionId ? app.lobby : lobby;
		return playerStatsMessage(current.players);
	}

	async disable() {
		this.#disposeWatchers?.();
		this.#disposeWatchers = null;

		this.#clearIntervals();
		this.#resetPlayerStats();
	}

	defaultSettings(): TwitchBotSettings {
		return {
			enablePlayerStats: false,
			messages: []
		};
	}
}

export const twitchBot = new TwitchBot();
