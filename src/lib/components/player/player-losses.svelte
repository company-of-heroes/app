<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { playerResult, stats } = usePlayer();
</script>

<span class="text-center text-red-100" {...restProps}>
	{#if playerResult}
		{playerResult.losses}
	{:else if stats}
		{stats.losses}
	{:else}
		-
	{/if}
</span>
