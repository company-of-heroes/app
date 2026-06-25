import { watch } from 'runed';
import { Feature } from '../feature.svelte';
import type { Overlay } from './overlays/overlay.svelte';

/**
 * Registry for Twitch stream overlays. Each overlay registers itself with the
 * local relay server so the overlays web app can render it.
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
