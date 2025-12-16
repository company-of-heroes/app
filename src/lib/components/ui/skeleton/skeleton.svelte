<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {} & HTMLAttributes<HTMLDivElement>;

	let { ...restProps }: Props = $props();
</script>

<div class={cn('bg-secondary-700 animate-pulse rounded-lg', restProps.class)}></div>
