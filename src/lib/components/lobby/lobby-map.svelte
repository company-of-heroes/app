<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { useLobby } from '.';
	import { getMapImageFromName } from '$lib/utils/game';
	import { cn } from '$lib/utils';

	type Props = HTMLImgAttributes;

	const { ...restProps }: Props = $props();
	const lobby = $derived(useLobby());
</script>

<div
	class={cn(
		'relative flex aspect-square items-center justify-center rounded-lg',
		'border-secondary-800 bg-secondary-950/40 border'
	)}
>
	<div
		class={cn(`absolute inset-0 bg-cover bg-center opacity-30`)}
		style="background-image: url('{getMapImageFromName(lobby.map!)}');"
	></div>
	<img
		src={getMapImageFromName(lobby.map!)}
		alt={lobby.map!}
		class="relative z-10 w-full rounded-lg"
		{...restProps}
	/>
</div>
