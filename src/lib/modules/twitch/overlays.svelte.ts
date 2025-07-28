import type { Overlay } from './overlays/overlay.svelte';
import { app } from '$core/app';
import { Bootable } from '../bootable.svelte';
import { ChatOverlay } from './overlays/chat..svelte';
import { OppBotOverlay } from './overlays/opp-bot.svelte';

export class Overlays extends Bootable {
	enabled = $derived(true);

	overlays: Overlay[] = $state([]);

	overlay: Overlay = $derived(this.overlays[1]);

	async init() {
		const overlays = [new ChatOverlay(), new OppBotOverlay()];

		for await (const overlay of overlays) {
			if (!(await overlay.isInstalled())) {
				await overlay.install();
			}

			this.overlays.push(await overlay.activate());
		}
	}

	async load(overlay: Overlay) {
		this.overlay = overlay;
	}

	destroy(): Promise<void> | void {}
}
