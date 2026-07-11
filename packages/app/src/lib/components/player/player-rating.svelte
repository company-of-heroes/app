<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const { playerResult } = $derived(usePlayer());
	const rating = $derived(playerResult?.newrating ?? undefined);
</script>

<span {...restProps} class={cn('text-center tabular-nums', restProps.class)}>
	{rating ?? 'N/A'}
</span>
