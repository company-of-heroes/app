<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Dialog, type DialogDescriptionPropsWithoutHTML } from 'bits-ui';

	let { ...props }: DialogDescriptionPropsWithoutHTML & { class?: string } = $props();
</script>

<Dialog.Description {...props} class={cn(props.class)}>
	{@render props.children?.()}
</Dialog.Description>
