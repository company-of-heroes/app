<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import MapImage from '$lib/components/ui/map-image.svelte';
	import { useMatch } from '.';

	type Props = HTMLImgAttributes & { small?: boolean };

	const { small = false, ...restProps }: Props = $props();
	const match = useMatch();
</script>

<MapImage map={match.map} {small} {...restProps} />
