<script lang="ts">
	import { cn } from '$lib/utils';
	import { Tabs, type TabsTriggerPropsWithoutHTML } from 'bits-ui';

	let { ...props }: TabsTriggerPropsWithoutHTML = $props();
</script>

<Tabs.Trigger
	{...props}
	class={cn(
		'bg-secondary-800 px-4 py-1.5',
		'hover:bg-secondary-900 hover:cursor-pointer',
		'data-[state=active]:bg-primary data-[state=active]:text-black'
	)}
>
	{@render props.children?.()}
</Tabs.Trigger>
