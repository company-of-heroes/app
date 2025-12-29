<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { useLobby } from '.';
	import { getMapImageFromName } from '$lib/utils/game';

	type Props = HTMLImgAttributes;

	const { ...restProps }: Props = $props();
	const lobby = $derived(useLobby());
</script>

<img
	src={getMapImageFromName(lobby.map!)}
	alt={lobby.map!}
	class="w-full rounded-lg"
	{...restProps}
/>
