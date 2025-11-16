import { Overlay } from '../overlay.svelte';
import zip from './opp-overlay.zip?url';

export class OppBotOverlay extends Overlay {
	name = 'Opponent Bot';
	path = 'overlays/oppbot';
	zipUrl = zip;
}
