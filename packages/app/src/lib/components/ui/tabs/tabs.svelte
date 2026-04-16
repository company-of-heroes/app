<script lang="ts">
	import { Tabs, type TabsRootPropsWithoutHTML } from 'bits-ui';

	let { ...props }: TabsRootPropsWithoutHTML = $props();
</script>

<Tabs.Root {...props} class="flex flex-1 flex-col">
	{@render props.children?.()}
</Tabs.Root>
