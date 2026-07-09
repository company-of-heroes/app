<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import * as List from '$lib/components/ui/list';
	import { useReplay } from '.';
	import { cn } from '$lib/utils';
	import { getString } from '$lib/utils/game';
	import MapImage from '$lib/components/ui/map-image.svelte';
	import { H } from '../ui/h';
	import { Badge } from '../ui/badge';
	import dayjs from '$lib/dayjs';
	import X from 'phosphor-svelte/lib/XSquare';
	import Ranking from 'phosphor-svelte/lib/Ranking';

	type Props = {} & HTMLAttributes<HTMLDivElement>;

	let { ...restProps }: Props = $props();
	let replay = $derived(useReplay());
	let isRanked = $derived(replay.matchType === 'automatch');
	const mapKey = $derived(replay.mapFileName.split(/[/\\]/).pop());
</script>

<div {...restProps} class={cn('grid grid-cols-1 gap-4 lg:grid-cols-[minmax(180px,280px)_minmax(0,1fr)] lg:gap-6 xl:gap-8', restProps.class)}>
	<MapImage map={mapKey} alt={getString(replay.mapName)} />
	<div class="py-4">
		<H level="2" class="mb-4">{getString(replay.mapName)}</H>
		<List.Root>
			<List.Title>Date:</List.Title>
			<List.Value>{replay.gameDate}</List.Value>
			<List.Title>Game Mode:</List.Title>
			<List.Value class="flex items-center gap-2">
				{#if isRanked}
					<Ranking class="text-primary" /> Ranked
				{:else}
					Custom Game
				{/if}
			</List.Value>
			{#if false === isRanked}
				<List.Title>Lobby Title:</List.Title>
				<List.Value>{replay.matchType}</List.Value>
			{/if}
			{#if replay.vpGame}
				<List.Title>Victory Points:</List.Title>
				<List.Value>{replay.vpCount}</List.Value>
			{/if}
			<List.Title>Duration:</List.Title>
			<List.Value>
				{dayjs
					.duration(replay.duration, 'seconds')
					.format(replay.duration < 3600 ? 'm[min]' : 'H[hr] m[min]')}
			</List.Value>
		</List.Root>
	</div>
</div>
