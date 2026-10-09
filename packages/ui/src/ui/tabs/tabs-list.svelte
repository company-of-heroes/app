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
	class={cn(
		'flex min-w-0 items-stretch justify-start gap-6 overflow-x-auto overflow-y-hidden',
		className
	)}
>
	{@render children?.()}
</Tabs.List>
