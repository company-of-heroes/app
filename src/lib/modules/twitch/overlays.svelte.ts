import { app } from '$core/app';
import { Bootable } from '../bootable.svelte';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export class Overlays extends Bootable {
	enabled = $derived(true);

	async init() {}
	destroy(): Promise<void> | void {
		//throw new Error('Method not implemented.');
	}
}
