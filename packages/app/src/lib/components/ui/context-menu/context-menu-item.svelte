<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ContextMenu } from 'bits-ui';

	type Props = ContextMenu.ItemProps & {};

	let { children, ...restProps }: Props = $props();
</script>

<ContextMenu.Item {...restProps}>
	{@render children?.()}
</ContextMenu.Item>
