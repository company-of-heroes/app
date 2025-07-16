<script lang="ts">
	import type { InputProps } from '.';
	import { cn } from '$lib/utils';

	let { value = $bindable(), ...restProps }: InputProps = $props();
</script>

<div class="flex flex-1 items-center">
	<input
		type="text"
		bind:value
		{...restProps}
		class={cn(
			'border-secondary-700 bg-secondary-900 focus:border-secondary-600 h-10 w-full border-2 px-4 focus:outline-none',
			restProps.class
		)}
	/>
</div>
