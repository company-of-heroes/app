<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { statLosses } from '$lib/components/ui/variants';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { class: className, ...restProps }: Props = $props();
	const { playerResult, stats } = $derived(usePlayer());
</script>

<span class={cn('text-center font-medium', statLosses, className)} {...restProps}>
	{#if playerResult}
		{playerResult.losses}
	{:else if stats}
		{stats.losses}
	{:else}
		-
	{/if}
</span>
