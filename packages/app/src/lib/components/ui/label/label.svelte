<script lang="ts">
	import { cn } from '$lib/utils';
	import type { LabelProps } from '.';

	let { children, ...restProps }: LabelProps = $props();
</script>

<label {...restProps} class={cn('font-medium text-neutral-400', restProps.class)}>
	{@render children()}
</label>
