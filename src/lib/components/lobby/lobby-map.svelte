<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { useLobby } from '.';
	import { getMapImageFromName } from '$lib/utils/game';

	type Props = HTMLImgAttributes;

	const { ...restProps }: Props = $props();
	const lobby = useLobby();
</script>

<div class="grid aspect-square place-items-center overflow-clip rounded-lg bg-gray-900">
	<img src={getMapImageFromName(lobby.map!)} alt={lobby.map!} class="w-full" {...restProps} />
</div>
