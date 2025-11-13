<script lang="ts">
	import { Tabs, type TabsListPropsWithoutHTML } from 'bits-ui';

	let { ...props }: TabsListPropsWithoutHTML = $props();
</script>

<Tabs.List
	{...props}
	class="mb-6 flex w-fit items-center justify-start gap-1 rounded-md bg-gray-900 p-1.5"
>
	{@render props.children?.()}
</Tabs.List>
