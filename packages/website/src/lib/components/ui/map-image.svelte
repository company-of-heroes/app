<script lang="ts">
	import MapImage from '@company-of-heroes/ui/map-image';
	import { resolveMapSrc } from '$lib/utils/resolvers';

	type Props = {
		map: string | undefined;
		alt?: string;
		class?: string;
		small?: boolean;
		flush?: boolean;
	};

	let { map, alt, class: className, small = false, flush = false }: Props = $props();
</script>

<MapImage {map} {alt} class={className} {small} {flush} resolveMapSrc={resolveMapSrc} />
