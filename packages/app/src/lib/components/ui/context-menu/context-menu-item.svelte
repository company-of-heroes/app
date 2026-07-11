<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ContextMenu } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { menuItem } from '../variants';

	type Props = ContextMenu.ItemProps & {};

	let { children, ...restProps }: Props = $props();
</script>

<ContextMenu.Item {...restProps} class={cn(menuItem, restProps.class)}>
	{@render children?.()}
</ContextMenu.Item>
