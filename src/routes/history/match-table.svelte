<script lang="ts">
	import * as Match from '$lib/components/match';
	import { Table, TD, TH, THead, TR } from '$lib/components/ui/table';
	import type { MatchList } from './match-list.svelte';

	interface Props {
		list: MatchList;
	}

	let { list }: Props = $props();

	function viewport(node: HTMLElement) {
		const observer = new IntersectionObserver((entries) => {
			if (!entries[0]?.isIntersecting) return;
			if (list.isLoading || !list.hasMore) return;
			list.loadMore();
		});

		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}
</script>

<Table>
	<THead>
		<TH width="5/24">Map</TH>
		<TH width="3/24">
			{#if list.filters.scope === 'community'}
				By
			{/if}
		</TH>
		<TH width="4/24">Title</TH>
		<TH width="3/24">Allies</TH>
		<TH width="3/24">Axis</TH>
		<TH width="4/24">Date</TH>
		<TH width="2/24"></TH>
	</THead>

	{#if list.matches.length > 0}
		{#each list.matches as match (match.id)}
			{@const alias =
				match.players.find((p) => p.steamId && match.user?.steamIds?.includes(p.steamId))?.profile
					?.alias || 'Unknown'}
			<Match.Root {match}>
				<TR class="text-gray-200" href={`/history/${match.id}`}>
					<TD width="5/24" class="flex items-center">
						<Match.MapImage />
						<Match.MapName />
					</TD>
					<TD width="3/24" class="truncate">
						{#if list.filters.scope === 'user'}
							<Match.Rating class="flex justify-center" />
						{:else}
							<span>{alias}</span>
						{/if}
					</TD>
					<TD width="4/24">
						<Match.Title />
					</TD>
					<TD width="3/24">
						<Match.Players team="allies" />
					</TD>
					<TD width="3/24">
						<Match.Players team="axis" />
					</TD>
					<TD width="4/24">
						<Match.Date />
					</TD>
					<TD width="2/24">
						<Match.Status />
					</TD>
				</TR>
			</Match.Root>
		{/each}

		{#if list.hasMore}
			<div use:viewport class="border-secondary-800 w-full border-t px-4 py-2">
				<small>
					Showing {list.matches.length} matches
					{#if list.isLoading}
						(loading...)
					{/if}
				</small>
			</div>
		{:else}
			<div class="border-secondary-800 w-full border-t px-4 py-2">
				<small>Showing {list.matches.length} matches</small>
			</div>
		{/if}
	{:else}
		<div class="border-secondary-800 w-full border-t px-4 py-2">
			<small>
				{#if list.isLoading}
					Loading matches...
				{:else}
					No matches found.
				{/if}
			</small>
		</div>
	{/if}
</Table>
