<script lang="ts">
	import { Dialog, type DialogPortalProps } from 'bits-ui';

	let { ...props }: DialogPortalProps = $props();
</script>

<Dialog.Portal {...props}>
	{@render props.children?.()}
</Dialog.Portal>
