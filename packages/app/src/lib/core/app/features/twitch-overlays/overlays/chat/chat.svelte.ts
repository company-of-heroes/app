import { Overlay } from '../overlay.svelte';
import zip from './chat.zip?base64';

export class ChatOverlay extends Overlay {
	path = 'overlays/chat';
	zipUrl = zip;
	name = 'Chat Overlay';
}
