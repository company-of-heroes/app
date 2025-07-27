<script lang="ts">
	import { cn } from '$lib/utils';
	import { Tabs, type TabsContentPropsWithoutHTML } from 'bits-ui';

	let { ...props }: TabsContentPropsWithoutHTML & { class: string } = $props();
</script>

<Tabs.Content {...props} class={cn('flex h-full flex-col', props.class)}>
	{@render props.children?.()}
</Tabs.Content>
