<script lang="ts">
	import { cn } from '$lib/utils';
	import type { LabelProps } from '.';
	import { labelText } from '../variants';

	let { children, ...restProps }: LabelProps = $props();
</script>

<label {...restProps} class={cn(labelText, restProps.class)}>
	{@render children()}
</label>
