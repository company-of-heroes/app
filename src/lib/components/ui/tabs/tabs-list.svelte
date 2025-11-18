<script lang="ts">
	import { Tabs, type TabsListPropsWithoutHTML } from 'bits-ui';

	let { ...props }: TabsListPropsWithoutHTML = $props();
</script>

<Tabs.List
	{...props}
	class="border-secondary-700 mb-6 flex w-fit items-center justify-start gap-1 rounded-md border p-1"
>
	{@render props.children?.()}
</Tabs.List>
