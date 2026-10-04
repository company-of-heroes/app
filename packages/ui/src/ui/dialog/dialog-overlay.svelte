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
		props.class
	)}
/>
