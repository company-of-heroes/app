import { watch } from 'runed';
import { Plugin } from '../plugin.svelte';
import type { Overlay } from './overlays/overlay.svelte';

export class TwitchOverlays extends Plugin {
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

	disable(): Promise<void> {
		throw new Error('Method not implemented.');
	}
}

export const twitchOverlays = new TwitchOverlays();
