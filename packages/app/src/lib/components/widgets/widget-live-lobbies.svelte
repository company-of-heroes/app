<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { H } from '$lib/components/ui/h';
	import { cn } from '$lib/utils';
	import LiveLobbiesTable from './live-lobbies-table.svelte';
	import { LiveLobbiesFeed } from './live-lobbies.svelte';

	const feed = new LiveLobbiesFeed();

	onMount(() => {
		void feed.start();
	});

	onDestroy(() => {
		void feed.stop();
	});
</script>

<div
	class={cn(
		'bg-secondary-950/40 border-secondary-900 overflow-clip rounded-lg border',
		'hover:border-secondary-700 transition-colors'
	)}
>
	<div class="border-secondary-800 flex items-center justify-between border-b px-5 py-3">
		<H level="6" class="mb-0 font-semibold">Live lobbies</H>
		{#if !feed.isLoading}
			<span class="text-secondary-400 text-sm tabular-nums">{feed.totalItems} active</span>
		{/if}
	</div>

	{#if feed.isLoading}
		<LiveLobbiesTable lobbies={[]} loading />
	{:else if feed.items.length === 0}
		<p class="text-secondary-400 px-5 py-3 text-sm">No community members are in a match right now.</p>
	{:else}
		<LiveLobbiesTable lobbies={feed.items} />
	{/if}
</div>
