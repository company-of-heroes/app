import { createReplay, useReplay } from './context';
import Replay from './replay.svelte';
import ReplayTitle from './replay-title.svelte';
import ReplayPlayers from './replay-players.svelte';
import ReplayChat from './replay-chat.svelte';
import ReplayDetails from './replay-details.svelte';

export {
	createReplay,
	useReplay,
	Replay as Root,
	ReplayTitle as Title,
	ReplayPlayers as Players,
	ReplayChat as Chat,
	ReplayDetails as Details
};
