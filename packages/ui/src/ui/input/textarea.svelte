<script lang="ts">
	import type { TextareaProps } from '.';
	import { cn } from '@company-of-heroes/ui/cn';
	import { controlBase, controlDisabled, flushTextarea } from '../../variants';

	let {
		value = $bindable(),
		class: className,
		flush = false,
		...restProps
	}: TextareaProps = $props();
</script>

<textarea
	bind:value
	{...restProps}
	class={cn(
		flush ? flushTextarea : cn(controlBase, 'h-auto w-full px-4 py-3 text-sm'),
		controlDisabled,
		className
	)}
></textarea>
