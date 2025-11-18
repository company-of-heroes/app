import { Overlay } from '../overlay.svelte';
import zip from './oppbot.zip?url';

export class OppBotOverlay extends Overlay {
	name = 'Opponent Bot';
	path = 'overlays/oppbot';
	zipUrl = zip;
}
