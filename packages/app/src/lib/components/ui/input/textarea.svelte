<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = {} & HTMLTextareaAttributes;

	let { value = $bindable(), ...restProps }: Props = $props();
</script>

<textarea
	bind:value
	{...restProps}
	class={cn(
		'rounded-md',
		'border-secondary-800 bg-secondary-800/30 focus:border-secondary-600 w-full border px-4 py-3 text-sm focus:outline-none',
		'disabled:bg-secondary-950 disabled:border-secondary-800 disabled:text-secondary-500 disabled:cursor-not-allowed',
		restProps.class
	)}
></textarea>
