<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { upperCase } from 'lodash-es';
	import { usePlayer } from '.';

	type Props = HTMLAttributes<HTMLImageElement>;

	const { ...restProps }: Props = $props();

	const player = usePlayer();
</script>

{#if player.profile}
	<img
		src="https://flagsapi.com/{upperCase(player.profile?.country)}/shiny/64.png"
		alt={player.profile?.country}
		class="w-full"
		{...restProps}
	/>
{/if}
