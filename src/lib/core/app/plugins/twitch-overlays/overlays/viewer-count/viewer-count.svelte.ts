import { app } from '$core/app/app.svelte';
import { twitch } from '$plugins/twitch';
import { watch } from 'runed';
import { Overlay } from '../overlay.svelte';
import zip from './viewer-count.zip?url';

export class ViewerCountOverlay extends Overlay {
	name = 'Viewer Count';
	path = 'overlays/viewer-count';
	zipUrl = zip;

	private intervalId: ReturnType<typeof setInterval> | null = null;

	constructor() {
		super();

		$effect.root(() => {
			watch(
				() => twitch.isConnected,
				() => {
					if (twitch.isConnected) {
						this.intervalId = setInterval(() => this.getViewerCount(), 5000);
					} else {
						if (this.intervalId) {
							clearInterval(this.intervalId);
							this.intervalId = null;
						}
					}
				}
			);
		});

		app.socket?.publish('twitch.viewers', { count: 0 });
	}

	getViewerCount() {
		if (!twitch.token || !twitch.client) {
			return;
		}

		console.log('Fetching viewer count...');

		twitch.client?.streams.getStreamByUserId(twitch.token.userId).then((stream) => {
			app.socket?.publish('twitch.viewers', { count: stream ? stream.viewers : 0 });
		});
	}
}
