<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useReplay } from '.';
	import { cn } from '$lib/utils';
	import { getMapImageFromName } from '$lib/utils/game';
	import { getString } from '$lib/utils/game';
	import { H } from '../ui/h';
	import { Badge } from '../ui/badge';
	import dayjs from '$lib/dayjs';
	import X from 'phosphor-svelte/lib/XSquare';
	import Check from 'phosphor-svelte/lib/CheckSquare';

	type Props = {} & HTMLAttributes<HTMLDivElement>;

	let { ...restProps }: Props = $props();
	let replay = useReplay();
	let isRanked = $derived(replay.matchType === 'automatch');

	console.log(replay);
</script>

<div {...restProps} class={cn('grid grid-cols-[300px_auto] gap-8', restProps.class)}>
	<img
		src={getMapImageFromName(replay.mapFileName.split(/[/\\]/).pop())}
		alt={getString(replay.mapName)}
		class="rounded-lg bg-gray-950"
	/>
	<div class="py-4">
		<span class="text-secondary-300 mb-2 inline-block">{replay.gameDate}</span>
		<H level="2" class="mb-4">{getString(replay.mapName)}</H>
		<div class="grid gap-1 [&>div]:flex [&>div]:items-center [&>div]:gap-4">
			<div>
				<strong>Type:</strong>
				<Badge>{isRanked ? 'Ranked' : 'Custom game'}</Badge>
			</div>
			{#if false === isRanked}
				<div>
					<strong>Lobby title:</strong>
					<span>{replay.matchType}</span>
				</div>
			{/if}
			{#if replay.vpGame}
				<div>
					<strong>Victory points:</strong>
					<span>{replay.vpCount}</span>
				</div>
			{/if}
			<div>
				<strong>Duration:</strong>
				<span>
					{dayjs
						.duration(replay.duration, 'seconds')
						.format(replay.duration < 3600 ? 'm[min]' : 'H[hr] m[min]')}
				</span>
			</div>
			{#if false === isRanked}
				<div>
					<strong>High resources:</strong>
					{#if replay.highResources}
						<Check size={24} class="text-green-500" />
					{:else}
						<X size={24} class="text-red-500" />
					{/if}
				</div>
				<div>
					<strong>Random start:</strong>
					{#if replay.randomStart}
						<Check size={24} class="text-green-500" />
					{:else}
						<X size={24} class="text-red-500" />
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
