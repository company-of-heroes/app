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
		'rounded-md px-4 py-1.5 font-bold transition-colors',
		'not-disabled:hover:bg-secondary-950/50 not-disabled:hover:cursor-pointer',
		'not-disabled:data-[state=active]:bg-primary not-disabled:data-[state=active]:text-secondary-950',
		'disabled:text-secondary-500 transition-colors duration-100',
		variant === 'secondary' &&
			'data-[state=active]:bg-primary/5 border-b-2 border-b-gray-500 bg-transparent data-[state=active]:text-white'
	)}
>
	{@render props.children?.()}
</Tabs.Trigger>
