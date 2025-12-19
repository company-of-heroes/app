<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { getMapImageFromName } from '$lib/utils/game';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';

	type Props = HTMLImgAttributes;

	const { ...restProps }: Props = $props();
	const match = useMatch();
</script>

<img
	{...restProps}
	src={getMapImageFromName(match.map)}
	alt={match.map}
	class={cn('mr-2 w-8', restProps.class)}
/>
