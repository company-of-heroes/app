import type { App } from '$core/app';
import { Overlay, type OverlayFile } from './overlay.svelte';
import { Command } from '@tauri-apps/plugin-shell';
import ChatOverlayZip from '$lib/files/overlays/chat-overlay.zip?raw';
import { dataDir } from '@tauri-apps/api/path';
import { fetch } from '@tauri-apps/plugin-http';

export class ChatOverlay extends Overlay {
	name = 'Chat Overlay';

	path = 'overlays/chat';

	constructor() {
		super();

		this.on('init', async (app) => {
			//const buffer = atob(ChatOverlayZip);
			// await writeFile(`${this.path}/chat-overlay.zip`, zipData, { baseDir: this.baseDir });
			// const extractCommand = Command.create(
			// 	'tar',
			// 	['-xf', `${this.path}/chat-overlay.zip`, '-C', this.path],
			// 	{
			// 		cwd: await dataDir()
			// 	}
			// );
			// await extractCommand.execute();
		});
	}

	init(app: App) {
		const twitch = app.getModule('twitch');
		console.log(app);
		twitch.chatClient?.onMessage((channel, user, text, msg) => {
			app.socket.publish('twitch.chat', {
				type: 'message',
				data: {
					channel,
					user,
					text: this.replaceEmotesWithImages(text, msg.emoteOffsets),
					msg
				}
			});
		});
	}

	onInstall() {}

	private replaceEmotesWithImages(text: string, emoteOffsets: Map<string, string[]>): string {
		let result = text;
		const replacements: Array<{ start: number; end: number; replacement: string }> = [];

		emoteOffsets.forEach((positions, emoteId) => {
			positions.forEach((pos) => {
				const [start, end] = pos.split('-').map(Number);
				const emoteName = text.substring(start, end + 1);
				const emoteUrl = `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/2.0`;

				replacements.push({
					start,
					end,
					replacement: `<img src="${emoteUrl}" alt="${emoteName}" class="emote" title="${emoteName}" />`
				});
			});
		});

		replacements.sort((a, b) => b.start - a.start);

		replacements.forEach(({ start, end, replacement }) => {
			result = result.substring(0, start) + replacement + result.substring(end + 1);
		});

		return result;
	}
}
