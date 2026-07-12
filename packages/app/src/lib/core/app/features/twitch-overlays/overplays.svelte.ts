import { watch } from 'runed';
import { Feature } from '../feature.svelte';
import type { Overlay } from './overlays/overlay.svelte';

/**
 * Registry for the Opponent Bot overlay. Installs local source for editing and
 * publishes to the hosted overlay route on api.coh1stats.com.
 */
export class TwitchOverlays extends Feature {
	name = 'twitch-overlays';

	overlays: Overlay[] = $state([]);

	#disposeWatchers: (() => void) | null = null;

	registerOverlay(overlay: Overlay) {
		if (this.overlays.find((o) => o.name === overlay.name)) {
			return;
		}

		this.overlays.push(overlay);
	}

	async enable() {
		this.#disposeWatchers = $effect.root(() => {
			watch(
				() => this.overlays,
				(overlays) => {
					overlays.forEach((overlay) => overlay.register());
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
