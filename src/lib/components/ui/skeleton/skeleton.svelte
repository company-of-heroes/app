<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {} & HTMLAttributes<HTMLDivElement>;

	let { ...restProps }: Props = $props();
</script>

<div class={cn('animate-pulse rounded-lg bg-gray-700', restProps.class)}></div>
