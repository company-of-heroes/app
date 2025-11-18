<script lang="ts">
	import type { Snippet } from 'svelte';
	import { DropdownMenu } from 'bits-ui';
	import { cn } from '$lib/utils';

	type Props = DropdownMenu.ItemProps;

	let { children, ...restProps }: Props = $props();
</script>

<DropdownMenu.Item
	{...restProps}
	class={cn(
		'cursor-pointer rounded px-4 py-2 text-gray-200 transition-colors hover:bg-gray-700 hover:text-white'
	)}
>
	{@render children?.()}
</DropdownMenu.Item>
