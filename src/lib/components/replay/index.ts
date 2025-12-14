import { parseReplay, type ReplayData } from '@fknoobs/replay-parser';
import { Context } from 'runed';
import Replay from './replay.svelte';
import ReplayTitle from './replay-title.svelte';
import ReplayPlayers from './replay-players.svelte';
import ReplayChat from './replay-chat.svelte';
import ReplayDetails from './replay-details.svelte';

const context = new Context<ReplayData>('<replay />');
export const createReplay = (file: ArrayBuffer | Uint8Array) => context.set(parseReplay(file));
export const useReplay = () => context.get();

export {
	Replay as Root,
	ReplayTitle as Title,
	ReplayPlayers as Players,
	ReplayChat as Chat,
	ReplayDetails as Details
};
