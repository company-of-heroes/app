import type { RelicProfile } from '@fknoobs/app';
import type { SteamPlayerSummary } from '$core/steam';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { dev } from '$app/environment';
import Emittery from 'emittery';

/**
 * Tracks the Company of Heroes process: running state, window focus and the
 * in-game chat state (reported by the Rust side).
 *
 * Unlike the previous implementation, nothing starts at module import time;
 * `start()` is invoked by the boot pipeline and `stop()` disposes all timers
 * and event listeners.
 */
export class Game extends Emittery {
	isRunning = $state(false);
	isIngame = $state(false);
	steamId = $state<string>();
	profile = $state<{ relic: RelicProfile; steam: SteamPlayerSummary }>();
	isWindowFocused = $state<boolean>(false);

	/** Best-effort: Enter toggles open/send. Resets on lobby transitions because CoH can close chat without Escape. */
	isIngameChatOpen = $state(false);

	/** Prevents duplicate "game started" notifications per session. */
	didNotify = $state<boolean>(false);

	#checkGameInterval: ReturnType<typeof setInterval> | null = null;
	#focusInterval: ReturnType<typeof setInterval> | null = null;
	#unlisteners: UnlistenFn[] = [];
	#started = false;
	#processCheckGeneration = 0;

	/** Begins process / focus / chat tracking. Idempotent. */
	async start(): Promise<void> {
		if (this.#started) {
			return;
		}

		this.#started = true;

		this.#checkGameInterval = setInterval(() => {
			void this.#pollProcessRunning();
		}, 1000);

		this.#unlisteners.push(
			await listen('game-chat-enter', () => {
				this.toggleIngameChatOpen();
			}),
			await listen('game-chat-escape', () => {
				this.closeIngameChatOpen();
			})
		);
	}

	stop(): void {
		if (this.#checkGameInterval) {
			clearInterval(this.#checkGameInterval);
			this.#checkGameInterval = null;
		}

		this.#processCheckGeneration += 1;
		this.#stopTrackingWindowFocus();

		for (const unlisten of this.#unlisteners) {
			unlisten();
		}

		this.#unlisteners = [];
		this.#started = false;
	}

	async #pollProcessRunning(): Promise<void> {
		const generation = ++this.#processCheckGeneration;

		try {
			const running = dev
				? true
				: await invoke<boolean>('is_running', { processName: 'RelicCOH.exe' });

			if (generation !== this.#processCheckGeneration) {
				return;
			}

			if (running !== this.isRunning) {
				this.isRunning = running;

				if (running) {
					this.#trackWindowFocus();
				} else {
					this.#stopTrackingWindowFocus();
				}
			}
		} catch (error) {
			if (generation === this.#processCheckGeneration) {
				console.error('[GAME]: process check failed:', error);
			}
		}
	}

	toggleIngameChatOpen() {
		this.isIngameChatOpen = !this.isIngameChatOpen;
	}

	closeIngameChatOpen() {
		this.isIngameChatOpen = false;
	}

	/**
	 * Reads the foreground window now and updates `isWindowFocused`.
	 * Prefer this over the polled flag when deciding to play the match-start sound
	 * (poll can be up to ~1s stale right after alt-tabbing out).
	 */
	async refreshWindowFocus(): Promise<boolean> {
		try {
			const title = await invoke<string>('get_active_window_title');
			const focused = title.includes('Company Of Heroes');
			this.isWindowFocused = focused;

			if (!focused) {
				this.isIngameChatOpen = false;
			}

			return focused;
		} catch (error) {
			console.error('[GAME]: Error getting active window title:', error);
			return this.isWindowFocused;
		}
	}

	#trackWindowFocus(): void {
		this.#stopTrackingWindowFocus();

		this.#focusInterval = setInterval(() => {
			void this.refreshWindowFocus();
		}, 1000);
	}

	#stopTrackingWindowFocus(): void {
		if (this.#focusInterval) {
			clearInterval(this.#focusInterval);
			this.#focusInterval = null;
		}

		this.isWindowFocused = false;
	}

	/** Clears all per-session game state (logout / game closed). */
	close(): void {
		this.isRunning = false;
		this.isIngame = false;
		this.steamId = '';
		this.profile = undefined;
		this.isWindowFocused = false;
		this.isIngameChatOpen = false;
		this.didNotify = false;
	}
}

export const game = new Game();
