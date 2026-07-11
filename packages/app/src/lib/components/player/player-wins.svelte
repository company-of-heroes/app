<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { statWins } from '$lib/components/ui/variants';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { class: className, ...restProps }: Props = $props();
	const { playerResult, stats } = $derived(usePlayer());
</script>

<span class={cn('text-center font-medium', statWins, className)} {...restProps}>
	{#if playerResult}
		{playerResult.wins}
	{:else if stats}
		{stats.wins}
	{:else}
		-
	{/if}
</span>
