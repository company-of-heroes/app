<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Dialog, type DialogClosePropsWithoutHTML } from 'bits-ui';

	let { ...props }: DialogClosePropsWithoutHTML & { class?: string } = $props();
</script>

<Dialog.Close {...props} class={cn('cursor-pointer', props.class)}>
	{@render props.children?.()}
</Dialog.Close>
