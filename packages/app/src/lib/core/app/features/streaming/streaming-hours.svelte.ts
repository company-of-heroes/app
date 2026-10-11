import { error } from '@tauri-apps/plugin-log';
import { watch } from 'runed';
import { pickOwnedSteamId, type StreamingProgress } from '@company-of-heroes/api';
import { Feature } from '$features/feature.svelte';
import { twitch } from '$features/twitch';
import { youtube } from '$features/youtube';
import { app } from '$core/app/context';
import { api } from '$core/api';
import { refreshPlayerLabels } from '$core/pocketbase/player-label-cache.svelte';
import { t } from '$lib/i18n';

export type StreamingHoursSettings = {
	enabled: boolean;
	/** Streamed time per Steam id not yet accepted by the server (survives restarts). */
	pendingBySteamId: Record<string, number>;
};

const TICK_MS = 30_000;
const FLUSH_MS = 60_000;
/** A tick never counts for more than this (sleep / suspended timers). */
const MAX_TICK_MS = 2 * TICK_MS;
/** Unsent time kept locally while signed out or offline. */
const MAX_PENDING_MS = 60 * 60 * 1000;

/**
 * Counts time live on Twitch or YouTube while Company of Heroes runs (once, even
 * when live on both) and reports it for the Steam account in game; at 12 hours the
 * website grants that Steam account the Streamer label.
 */
export class StreamingHours extends Feature<StreamingHoursSettings> {
	name = 'streaming-hours';

	progress: StreamingProgress | null = $state(null);

	/** The Steam account in game, else the first one on the account (progress is per Steam id). */
	steamId = $derived.by(() =>
		app.account.isAuthenticated
			? pickOwnedSteamId(app.account.user.steamIds, [app.game.steamId])
			: null
	);

	isCounting = $derived.by(
		() => (twitch.isLive || youtube.isLive) && app.game.isRunning && Boolean(app.game.steamId)
	);

	/** Server total plus what is still waiting to be sent. */
	streamedMs = $derived.by(
		() =>
			(this.progress?.streamedMs ?? 0) +
			(this.steamId ? (this.settings.pendingBySteamId[this.steamId] ?? 0) : 0)
	);

	#tickTimer: ReturnType<typeof setInterval> | null = null;
	#flushTimer: ReturnType<typeof setInterval> | null = null;
	#lastTick = 0;
	#flushing = false;
	#disposeWatchers: (() => void) | null = null;

	enable(): void {
		this.#lastTick = Date.now();
		this.#tickTimer = setInterval(() => this.#tick(), TICK_MS);
		this.#flushTimer = setInterval(() => void this.flush(), FLUSH_MS);

		this.#disposeWatchers = $effect.root(() => {
			watch(
				() => this.steamId,
				(steamId) => {
					this.progress = null;
					if (steamId) {
						void this.#loadProgress(steamId);
					}
				}
			);

			watch(
				() => this.isCounting,
				() => {
					this.#lastTick = Date.now();
				}
			);
		});
	}

	async disable() {
		this.#disposeWatchers?.();
		this.#disposeWatchers = null;
		if (this.#tickTimer) {
			clearInterval(this.#tickTimer);
			this.#tickTimer = null;
		}

		if (this.#flushTimer) {
			clearInterval(this.#flushTimer);
			this.#flushTimer = null;
		}
	}

	#tick() {
		const now = Date.now();
		const elapsed = Math.min(Math.max(0, now - this.#lastTick), MAX_TICK_MS);
		this.#lastTick = now;
		const steamId = app.game.steamId;
		if (!this.isCounting || !steamId) {
			return;
		}

		const pending = this.settings.pendingBySteamId;
		pending[steamId] = Math.min((pending[steamId] ?? 0) + elapsed, MAX_PENDING_MS);
	}

	async #loadProgress(steamId: string) {
		const result = await api.streaming.getProgress(steamId);
		if (result.isOk() && this.steamId === steamId) {
			this.progress = result.value;
			// The server (re)labels the Steam id while answering; show that right away.
			if (result.value.badgeGranted) {
				refreshPlayerLabels([steamId]);
			}
		}
	}

	/** Sends pending time per Steam id; the server may credit less than asked (it caps each report). */
	async flush(): Promise<void> {
		if (this.#flushing || !app.account.isAuthenticated) {
			return;
		}

		this.#flushing = true;
		try {
			for (const [steamId, pending] of Object.entries(this.settings.pendingBySteamId)) {
				if (pending > 0) {
					await this.#report(steamId, pending);
				}
			}
		} finally {
			this.#flushing = false;
		}
	}

	async #report(steamId: string, pending: number) {
		const owned = app.account.user.steamIds?.map(String).includes(steamId);
		if (!owned) {
			// Unlinked from the account: the time no longer counts anywhere.
			delete this.settings.pendingBySteamId[steamId];
			return;
		}

		const result = await api.streaming.report({
			steamId,
			deltaMs: pending,
			twitchLogin: twitch.token?.userName ?? null,
			youtubeChannelId: youtube.channel?.id ?? null
		});
		if (result.isErr()) {
			void error(`[STREAMING]: report failed: ${result.error.message}`);
			return;
		}

		const { creditedMs, ...progress } = result.value;
		const left = Math.max(0, (this.settings.pendingBySteamId[steamId] ?? 0) - creditedMs);
		if (left > 0) {
			this.settings.pendingBySteamId[steamId] = left;
		} else {
			delete this.settings.pendingBySteamId[steamId];
		}

		if (steamId !== this.steamId) {
			return;
		}

		const justGranted =
			progress.badgeGranted && this.progress !== null && !this.progress.badgeGranted;
		this.progress = progress;
		if (justGranted) {
			refreshPlayerLabels([steamId]);
			app.toast.success(
				t('You streamed 12 hours of Company of Heroes — you now have the Streamer badge!')
			);
		}
	}

	defaultSettings(): StreamingHoursSettings {
		return { enabled: true, pendingBySteamId: {} };
	}
}

export const streamingHours = new StreamingHours();
