<script lang="ts">
	import { cn } from '$lib/utils';
	import { Tabs, type TabsTriggerPropsWithoutHTML } from 'bits-ui';

	let {
		variant = 'primary',
		...props
	}: TabsTriggerPropsWithoutHTML & {
		variant?: 'primary' | 'secondary';
	} = $props();
</script>

<Tabs.Trigger
	{...props}
	class={cn(
		'rounded px-4 py-1.5',
		'not-disabled:hover:bg-secondary-950 not-disabled:hover:cursor-pointer',
		'not-disabled:data-[state=active]:text-primary not-disabled:data-[state=active]:bg-gray-600',
		'transition-colors duration-100 disabled:text-gray-500',
		variant === 'secondary' &&
			'data-[state=active]:bg-primary/5 border-b-2 border-b-gray-500 bg-transparent data-[state=active]:text-white'
	)}
>
	{@render props.children?.()}
</Tabs.Trigger>
