<script lang="ts">
	import { Tabs, type TabsListPropsWithoutHTML } from 'bits-ui';

	let { ...props }: TabsListPropsWithoutHTML = $props();
</script>

<Tabs.List {...props} class=" mb-6 flex w-fit items-center justify-start gap-2 overflow-clip">
	{@render props.children?.()}
</Tabs.List>
