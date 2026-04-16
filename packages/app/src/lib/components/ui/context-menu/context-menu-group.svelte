<script lang="ts">
	import { ContextMenu } from 'bits-ui';

	type Props = ContextMenu.GroupProps & {};

	let { children, ...restProps }: Props = $props();
</script>

<ContextMenu.Group {...restProps}>
	{@render children?.()}
</ContextMenu.Group>
