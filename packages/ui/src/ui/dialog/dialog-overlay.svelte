<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Dialog, type DialogOverlayPropsWithoutHTML } from 'bits-ui';
	import { overlayBackdrop } from '../../variants';

	let { ...props }: DialogOverlayPropsWithoutHTML & { class?: string } = $props();
</script>

<Dialog.Overlay
	{...props}
	class={cn(
		overlayBackdrop,
		'fixed inset-0 z-50',
		'data-[state=open]:animate-in data-[state=open]:fade-in-0',
		'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
		props.class
	)}
/>
