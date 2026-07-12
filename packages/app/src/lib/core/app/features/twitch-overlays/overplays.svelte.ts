import { watch } from 'runed';
import { pocketbase } from '$core/pocketbase';
import { Feature } from '../feature.svelte';
import type { Overlay } from './overlays/overlay.svelte.ts';

/**
 * Registry for the Opponent Bot overlay. Installs local source for editing and
 * publishes to the hosted overlay route on api.coh1stats.com.
 */
export class TwitchOverlays extends Feature {
	name = 'twitch-overlays';

	overlays: Overlay[] = $state([]);

	#disposeWatchers: (() => void) | null = null;
	#ensurePublishedInFlight = false;

	registerOverlay(overlay: Overlay) {
		if (this.overlays.find((o) => o.name === overlay.name)) {
			return;
		}

		this.overlays.push(overlay);
	}

	async enable() {
		this.#disposeWatchers = $effect.root(() => {
			watch(
				() => [this.overlays, pocketbase.authStore.isValid] as const,
				([overlays, isAuthenticated]) => {
					void (async () => {
						for (const overlay of overlays) {
							await overlay.register();
						}

						if (!isAuthenticated || overlays.length === 0 || this.#ensurePublishedInFlight) {
							return;
						}

						this.#ensurePublishedInFlight = true;
						try {
							for (const overlay of overlays) {
								await overlay.ensurePublished();
							}
						} catch (error) {
							console.warn('[TWITCH-OVERLAYS]: ensurePublished failed:', error);
						} finally {
							this.#ensurePublishedInFlight = false;
						}
					})();
				}
			);
		});
	}

	async disable() {
		this.#disposeWatchers?.();
		this.#disposeWatchers = null;
	}

	defaultSettings() {
		return { enabled: true };
	}
}

export const twitchOverlays = new TwitchOverlays();
