import { watch } from 'runed';
import { Feature } from '../feature.svelte';
import type { Overlay } from './overlays/overlay.svelte';

export class TwitchOverlays extends Feature {
	name = 'overlays';

	overlays: Overlay[] = $state([]);

	registerOverlay(overlay: Overlay) {
		if (this.overlays.find((o) => o.name === overlay.name)) {
			return;
		}

		this.overlays.push(overlay);
	}

	async enable() {
		watch(
			() => this.overlays,
			(overlays) => {
				overlays.forEach((overlay) => overlay.register());
			}
		);
	}

	async disable() {}

	defaultSettings() {
		return { enabled: true };
	}
}

export const twitchOverlays = new TwitchOverlays();
