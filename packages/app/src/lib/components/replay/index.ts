import { createReplay, useReplay } from './context';
import Replay from './replay.svelte';
import ReplayTitle from './replay-title.svelte';
import ReplayPlayers from './replay-players.svelte';
import ReplayDetails from './replay-details.svelte';
import ReplayTabs from './replay-tabs.svelte';

export {
	createReplay,
	useReplay,
	Replay as Root,
	ReplayTitle as Title,
	ReplayPlayers as Players,
	ReplayDetails as Details,
	ReplayTabs as Tabs
};
