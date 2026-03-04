<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes;

	let { children, ...restProps }: Props = $props();
</script>

<button
	type="button"
	{...restProps}
	class={cn(
		'hover:bg-secondary-950 cursor-pointer rounded p-2 text-lg transition-colors',
		'data-[active=true]:bg-secondary-900',
		restProps.class
	)}
>
	{@render children?.()}
</button>
