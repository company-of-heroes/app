<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { playerResult, stats } = usePlayer();
</script>

<span class="text-center text-green-100" {...restProps}>
	{#if playerResult}
		{playerResult.wins}
	{:else if stats}
		{stats.wins}
	{:else}
		-
	{/if}
</span>
