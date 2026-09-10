<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Dialog, type DialogTitlePropsWithoutHTML } from 'bits-ui';

	let { ...props }: DialogTitlePropsWithoutHTML & { class?: string } = $props();
</script>

<Dialog.Title {...props} class={cn(props.class)}>
	{@render props.children?.()}
</Dialog.Title>
