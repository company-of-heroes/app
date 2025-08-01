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
		'bg-secondary-800 px-4 py-1.5',
		'hover:bg-secondary-900 hover:cursor-pointer',
		'data-[state=active]:bg-primary data-[state=active]:text-black',
		variant === 'secondary' &&
			'data-[state=active]:bg-primary/5 border-b-2 border-b-gray-500 bg-transparent data-[state=active]:text-white'
	)}
>
	{@render props.children?.()}
</Tabs.Trigger>
