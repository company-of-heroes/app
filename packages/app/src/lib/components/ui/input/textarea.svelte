<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { controlBase, controlDisabled } from '../variants';

	type Props = {} & HTMLTextareaAttributes;

	let { value = $bindable(), ...restProps }: Props = $props();
</script>

<textarea
	bind:value
	{...restProps}
	class={cn(
		controlBase,
		'h-auto w-full px-4 py-3 text-sm',
		controlDisabled,
		restProps.class
	)}
></textarea>
