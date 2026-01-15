<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement>;

	let { children, ...restProps }: Props = $props();
</script>

<div
	{...restProps}
	class={cn('border-secondary-800 overflow-clip rounded-lg border', restProps.class)}
>
	{@render children?.()}
</div>
