<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import MapImage from '../ui/map-image.svelte';
	import type { TournamentMap } from './types';

	type Props = {
		map: Pick<TournamentMap, 'ref' | 'name' | 'imageUrl'>;
		class?: string;
	};

	let { map, class: className }: Props = $props();
</script>

{#if map.imageUrl}
	<img
		src={map.imageUrl}
		alt={map.name}
		class={cn('border-secondary-800 aspect-square w-10 rounded-md border object-cover', className)}
	/>
{:else}
	<MapImage map={map.ref} alt={map.name} class={className} />
{/if}
