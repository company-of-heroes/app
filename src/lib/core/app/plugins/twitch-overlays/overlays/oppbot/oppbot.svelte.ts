import { Overlay } from '../overlay.svelte';
import zip from './oppbot.asdasd.zip?base64';

export class OppBotOverlay extends Overlay {
	name = 'Opponent Bot';
	path = 'overlays/oppbot';
	zipUrl = zip;
}
