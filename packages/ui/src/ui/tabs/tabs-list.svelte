<script lang="ts">
	import { Tabs, type TabsListPropsWithoutHTML } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';

	let {
		class: className,
		children,
		...restProps
	}: TabsListPropsWithoutHTML & { class?: string } = $props();
</script>

<Tabs.List
	{...restProps}
	class={cn('flex w-fit items-center justify-start gap-2 overflow-clip', className)}
>
	{@render children?.()}
</Tabs.List>
