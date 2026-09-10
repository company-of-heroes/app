<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Dialog, type DialogContentPropsWithoutHTML } from 'bits-ui';
	import { surfaceModal } from '../../variants';

	let { ...props }: DialogContentPropsWithoutHTML & { class?: string } = $props();
</script>

<Dialog.Content {...props} class={cn(surfaceModal, 'outline-hidden', props.class)}>
	{@render props.children?.()}
</Dialog.Content>
