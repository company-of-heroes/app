<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { upperCase } from 'lodash-es';
	import { usePlayer } from '.';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLImageElement>;

	const { ...restProps }: Props = $props();

	const player = usePlayer();
</script>

<img
	src="https://flagsapi.com/{upperCase(player.country)}/shiny/64.png"
	alt={player.country}
	class={cn('w-full', restProps.class)}
	{...restProps}
/>
