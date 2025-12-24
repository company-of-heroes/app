import { app } from '$core/app';
import { Feature } from '../feature.svelte';

export type ChatSettings = {
	enabled: boolean;
	muted: boolean;
};

export class ChatFeature extends Feature<ChatSettings> {
	name = 'chat';

	enable(): void | this | Promise<void | this> {
		console.log('Enabling chat feature');
		// Preload a default chat room (main chatroom)
		app.database.chatRooms.join('wdqhr1l7wb2byh4');
	}

	defaultSettings(): ChatSettings {
		return {
			enabled: true,
			muted: false
		};
	}
}

export const chat = new ChatFeature();
