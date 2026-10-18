<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Dialog, type DialogCloseProps } from 'bits-ui';

	let { ...props }: DialogCloseProps = $props();
</script>

<Dialog.Close {...props} class={cn('cursor-pointer', props.class)}>
	{@render props.children?.()}
</Dialog.Close>
