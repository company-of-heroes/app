import { error } from '@tauri-apps/plugin-log';
import { watch } from 'runed';
import type { StreamingProgress } from '@company-of-heroes/api';
import { Feature } from '$features/feature.svelte';
import { twitch } from '$features/twitch';
import { youtube } from '$features/youtube';
import { app } from '$core/app/context';
import { api } from '$core/api';
import { refreshPlayerLabels } from '$core/pocketbase/player-label-cache.svelte';
import { t } from '$lib/i18n';

export type StreamingHoursSettings = {
	enabled: boolean;
	/** Streamed time not yet accepted by the server (survives restarts). */
	pendingMs: number;
};

const TICK_MS = 30_000;
const FLUSH_MS = 60_000;
/** A tick never counts for more than this (sleep / suspended timers). */
const MAX_TICK_MS = 2 * TICK_MS;
/** Unsent time kept locally while signed out or offline. */
const MAX_PENDING_MS = 60 * 60 * 1000;

/**
 * Counts time live on Twitch or YouTube while Company of Heroes runs (once, even
 * when live on both) and reports it; at 12 hours the website grants the Streamer label.
 */
export class StreamingHours extends Feature<StreamingHoursSettings> {
	name = 'streaming-hours';

	progress: StreamingProgress | null = $state(null);

	isCounting = $derived.by(() => (twitch.isLive || youtube.isLive) && app.game.isRunning);

	/** Server total plus what is still waiting to be sent. */
	streamedMs = $derived.by(() => (this.progress?.streamedMs ?? 0) + this.settings.pendingMs);

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
				() => (app.account.isAuthenticated ? app.account.userId : ''),
				(userId) => {
					this.progress = null;
					if (userId) {
						void this.#loadProgress();
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
		if (!this.isCounting) {
			return;
		}

		this.settings.pendingMs = Math.min(this.settings.pendingMs + elapsed, MAX_PENDING_MS);
	}

	async #loadProgress() {
		const result = await api.streaming.getProgress();
		if (result.isOk()) {
			this.progress = result.value;
			// The server (re)labels the account while answering; show that right away.
			if (result.value.badgeGranted) {
				refreshPlayerLabels(app.account.user.steamIds);
			}
		}
	}

	/** Sends pending time; the server may credit less than asked (it caps each report). */
	async flush(): Promise<void> {
		const pending = this.settings.pendingMs;
		if (this.#flushing || pending <= 0 || !app.account.isAuthenticated) {
			return;
		}

		this.#flushing = true;
		try {
			const result = await api.streaming.report({
				deltaMs: pending,
				twitchLogin: twitch.token?.userName ?? null,
				youtubeChannelId: youtube.channel?.id ?? null
			});
			if (result.isErr()) {
				void error(`[STREAMING]: report failed: ${result.error.message}`);
				return;
			}

			const { creditedMs, ...progress } = result.value;
			const justGranted =
				progress.badgeGranted && this.progress !== null && !this.progress.badgeGranted;
			this.progress = progress;
			this.settings.pendingMs = Math.max(0, this.settings.pendingMs - creditedMs);
			if (justGranted) {
				refreshPlayerLabels(app.account.user.steamIds);
				app.toast.success(
					t('You streamed 12 hours of Company of Heroes — you now have the Streamer badge!')
				);
			}
		} finally {
			this.#flushing = false;
		}
	}

	defaultSettings(): StreamingHoursSettings {
		return { enabled: true, pendingMs: 0 };
	}
}

export const streamingHours = new StreamingHours();
