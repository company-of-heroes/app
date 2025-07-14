<script lang="ts">
	import { Tabs, type TabsListPropsWithoutHTML } from 'bits-ui';

	let { ...props }: TabsListPropsWithoutHTML = $props();
</script>

<Tabs.List {...props} class="mb-6 flex items-center justify-start gap-1">
	{@render props.children?.()}
</Tabs.List>
