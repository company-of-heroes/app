<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { upperCase } from 'lodash-es';
	import { usePlayer } from '.';
	import { cn, getFactionFlagFromRace, getRacePrefix } from '$lib/utils';
	import { factionIcon } from '$lib/components/ui/variants';

	type Props = HTMLImgAttributes;

	const { ...restProps }: Props = $props();
	const { player } = $derived(usePlayer());
</script>

<img
	{...restProps}
	src={getFactionFlagFromRace(player.race)}
	alt={getRacePrefix(player.race)}
	title={upperCase(getRacePrefix(player.race))}
	class={cn(factionIcon, 'hover:ring-secondary-700 transition-all', restProps.class)}
/>
