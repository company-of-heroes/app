import { app } from '$core/context';
import { twitch } from '$features/twitch';
import { watch } from 'runed';
import { Overlay } from '../overlay.svelte';
import zip from './viewer-count.zip?base64';

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

		twitch.client.streams
			.getStreamByUserId(twitch.token.userId)
			.then((stream) => {
				const viewerCount = stream?.viewers ?? 0;
				app.socket?.publish('twitch.viewers', { count: viewerCount });
			})
			.catch((err) => {
				console.error('Error fetching stream data:', err);
				app.socket?.publish('twitch.viewers', { count: 0 });
			});
	}
}
