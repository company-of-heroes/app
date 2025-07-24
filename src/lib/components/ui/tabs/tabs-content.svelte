<script lang="ts">
	import { Tabs, type TabsContentPropsWithoutHTML } from 'bits-ui';

	let { ...props }: TabsContentPropsWithoutHTML = $props();
</script>

<Tabs.Content {...props} class="flex h-full flex-col">
	{@render props.children?.()}
</Tabs.Content>
