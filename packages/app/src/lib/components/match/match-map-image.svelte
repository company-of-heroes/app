<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import MapImage from '@company-of-heroes/ui/map-image';
	import { cn } from '$lib/utils';
	import { useMatch } from '.';

	type Props = Pick<HTMLImgAttributes, 'alt' | 'class'> & { small?: boolean; flush?: boolean };

	const { small = false, flush = false, alt, class: className }: Props = $props();
	const match = useMatch();
</script>

<MapImage
	map={match.map}
	{small}
	{flush}
	alt={alt ?? undefined}
	class={className ? cn(className) : undefined}
/>
