<script lang="ts">
	import type { Snippet } from 'svelte';
	import { DropdownMenu } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { menuItem } from '../variants';

	type Props = DropdownMenu.ItemProps;

	let { children, ...restProps }: Props = $props();
</script>

<DropdownMenu.Item {...restProps} class={cn(menuItem, restProps.class)}>
	{@render children?.()}
</DropdownMenu.Item>
