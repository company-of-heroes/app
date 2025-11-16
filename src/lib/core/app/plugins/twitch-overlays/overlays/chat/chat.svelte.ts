import { Overlay } from '../overlay.svelte';
import zip from './chat-overlay.zip?url';

export class ChatOverlay extends Overlay {
	path = 'overlays/chat';
	zipUrl = zip;
	name = 'Chat Overlay';
}
