<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { useLobby } from '.';
	import { getMapImageFromName } from '$lib/utils/game';
	import { AspectRatio } from 'bits-ui';

	type Props = HTMLImgAttributes;

	const { ...restProps }: Props = $props();
	const lobby = useLobby();
</script>

<AspectRatio.Root
	ratio={1}
	class="border-secondary-800 flex items-center justify-center overflow-clip rounded-lg border"
>
	<img
		src={getMapImageFromName(lobby.map!)}
		alt={lobby.map!}
		class="absolute inset-0 z-5 h-full w-full scale-180 object-cover opacity-30"
		{...restProps}
	/>
	<img
		src={getMapImageFromName(lobby.map!)}
		alt={lobby.map!}
		class="absolute z-10 w-full object-cover"
		{...restProps}
	/>
</AspectRatio.Root>
