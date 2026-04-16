<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { upperCase } from 'lodash-es';
	import { usePlayer } from '.';
	import { cn, getFactionFlagFromRace, getRacePrefix, getRankImage } from '$lib/utils';
	import { app } from '$core/app/context';

	type Props = HTMLImgAttributes;

	const { ...restProps }: Props = $props();
	const { player } = $derived(usePlayer());
</script>

<img
	{...restProps}
	src={getFactionFlagFromRace(player.race)}
	alt={getRacePrefix(player.race)}
	title={upperCase(getRacePrefix(player.race))}
	class={cn(
		'ring-secondary-800 h-5 w-5 rounded-full object-cover ring-3',
		'hover:ring-secondary-700 transition-all',
		restProps.class
	)}
/>
