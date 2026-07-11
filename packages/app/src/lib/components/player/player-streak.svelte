<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { formatStreak, statStreakClass } from '$lib/components/ui/variants';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { class: className, ...restProps }: Props = $props();
	const { playerResult, stats } = $derived(usePlayer());

	const streak = $derived(playerResult?.streak ?? stats?.streak);
</script>

<span class={cn('text-center font-medium', streak !== undefined && statStreakClass(streak), className)} {...restProps}>
	{#if streak !== undefined}
		{formatStreak(streak)}
	{/if}
</span>
