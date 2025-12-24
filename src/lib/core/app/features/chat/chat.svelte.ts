import { app } from '$core/app';
import { Feature } from '../feature.svelte';

export class ChatFeature extends Feature {
	name = 'chat';

	enable(): void | this | Promise<void | this> {
		console.log('Enabling chat feature');
		// Preload a default chat room (main chatroom)
		app.database.chatRooms.join('wdqhr1l7wb2byh4');
	}

	defaultSettings(): { enabled: boolean } {
		return { enabled: true };
	}
}

export const chat = new ChatFeature();
