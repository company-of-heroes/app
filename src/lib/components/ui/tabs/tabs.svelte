<script lang="ts">
	import { Tabs, type TabsRootPropsWithoutHTML } from 'bits-ui';

	let { ...props }: TabsRootPropsWithoutHTML = $props();
</script>

<Tabs.Root {...props}>
	{@render props.children?.()}
</Tabs.Root>
