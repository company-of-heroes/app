<script lang="ts">
	import type { Snippet } from 'svelte';
	import ReplayCard from '../replay/replay-card.svelte';
	import type { CommunityMatch } from '../replay/types';
	import CardGrid from './card-grid.svelte';

	type Props = {
		matches: CommunityMatch[];
		meSteamIds?: string[];
		highlightedPlayers?: string[];
		/** Likes, comments and downloads; off for local replays. */
		showEngagement?: boolean;
		/** Renders each cell instead of the default `ReplayCard` (e.g. with library actions). */
		card?: Snippet<[CommunityMatch]>;
		/** Placeholder cards while loading (ignored when `matches` has items). */
		skeletons?: number;
		/** Last block above the footer: pull the closing line onto the parent's border. */
		closing?: boolean;
		/** Show only this many full rows at every breakpoint (cards past them are hidden). */
		rows?: 1 | 2;
		class?: string;
	};

	let {
		matches,
		meSteamIds = [],
		highlightedPlayers = [],
		showEngagement = true,
		card,
		skeletons = 0,
		closing = false,
		rows,
		class: className
	}: Props = $props();
</script>

{#snippet replayCard(match: CommunityMatch)}
	{#if card}
		{@render card(match)}
	{:else}
		<ReplayCard {match} {meSteamIds} {highlightedPlayers} {showEngagement} />
	{/if}
{/snippet}

<CardGrid items={matches} card={replayCard} {skeletons} {closing} {rows} class={className} />
