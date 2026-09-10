<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Dialog, type DialogTriggerPropsWithoutHTML } from 'bits-ui';

	let { ...props }: DialogTriggerPropsWithoutHTML & { class?: string } = $props();
</script>

<Dialog.Trigger {...props} class={cn(props.class)}>
	{@render props.children?.()}
</Dialog.Trigger>
