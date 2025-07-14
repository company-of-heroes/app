<script lang="ts">
	import { cn } from '$lib/utils';
	import { Accordion, type WithoutChildrenOrChild } from 'bits-ui';

	type Props = Accordion.ItemProps & {
		value?: string[];
		type?: 'single' | 'multiple';
	};

	let { value = $bindable(), type = 'single', children, ...restProps }: Props = $props();
</script>

<Accordion.Root
	bind:value
	{type}
	{...restProps}
	class={cn('flex flex-col gap-[2px]', restProps.class)}
>
	{@render children?.()}
</Accordion.Root>
