<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Dialog, type DialogTriggerProps } from 'bits-ui';

	let { ...props }: DialogTriggerProps = $props();
</script>

<Dialog.Trigger {...props} class={cn(props.class)}>
	{@render props.children?.()}
</Dialog.Trigger>
