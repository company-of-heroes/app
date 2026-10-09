<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Tabs, type TabsTriggerProps } from 'bits-ui';
	import { lineTabTrigger, sheetTabTrigger } from '../../variants';

	let {
		variant = 'line',
		...props
	}: TabsTriggerProps & { variant?: 'line' | 'sheet' } = $props();
</script>

<Tabs.Trigger
	{...props}
	class={cn(variant === 'sheet' ? sheetTabTrigger : lineTabTrigger, props.class)}
>
	{@render props.children?.()}
</Tabs.Trigger>
