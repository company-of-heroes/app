import { createReplay, useReplay } from './context';
import Replay from './replay.svelte';
import ReplayTitle from './replay-title.svelte';
import ReplayPlayers from './replay-players.svelte';
import ReplayChat from './replay-chat.svelte';
import ReplayDetails from './replay-details.svelte';
import ReplayActions from './replay-actions.svelte';
import ReplayTabs from './replay-tabs.svelte';
import ReplayTabsSkeleton from './replay-tabs-skeleton.svelte';
import ReplayPageSkeleton from './replay-page-skeleton.svelte';

export {
	createReplay,
	useReplay,
	Replay as Root,
	ReplayTitle as Title,
	ReplayPlayers as Players,
	ReplayChat as Chat,
	ReplayDetails as Details,
	ReplayActions as Actions,
	ReplayTabs as Tabs,
	ReplayTabsSkeleton as TabsSkeleton,
	ReplayPageSkeleton as PageSkeleton
};
