<script lang="ts">
	import { Dialog, type DialogRootPropsWithoutHTML } from 'bits-ui';

	let {
		children,
		open = $bindable(false),
		...restProps
	}: DialogRootPropsWithoutHTML = $props();
</script>

<Dialog.Root {...restProps} bind:open>
	{@render children?.()}
</Dialog.Root>
