<script lang="ts">
	import { Tabs, type TabsContentPropsWithoutHTML } from 'bits-ui';

	let { ...props }: TabsContentPropsWithoutHTML = $props();
</script>

<Tabs.Content {...props}>
	{@render props.children?.()}
</Tabs.Content>
