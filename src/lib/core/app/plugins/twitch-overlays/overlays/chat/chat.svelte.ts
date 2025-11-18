import { Overlay } from '../overlay.svelte';
import zip from './chat.zip?url';

export class ChatOverlay extends Overlay {
	path = 'overlays/chat';
	zipUrl = zip;
	name = 'Chat Overlay';
}
