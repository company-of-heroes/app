<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { upperCase } from 'lodash-es';
	import { usePlayer } from '.';
	import { cn, getFactionFlagFromRace, getRacePrefix, getRankImage } from '$lib/utils';

	type Props = HTMLImgAttributes;

	const { ...restProps }: Props = $props();
	const player = usePlayer();
</script>

<img
	{...restProps}
	src={await getFactionFlagFromRace(player.race_id)}
	alt={getRacePrefix(player.race_id)}
	title={upperCase(getRacePrefix(player.race_id))}
	class={cn(
		'border-secondary-800 h-6 w-6 rounded-full border-3 object-cover object-center',
		restProps.class
	)}
/>
