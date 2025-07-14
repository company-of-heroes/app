<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Accordion } from 'bits-ui';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';

	type Props = Accordion.ItemProps & {
		header: Snippet;
	};

	let { header, children, ...restProps }: Props = $props();
</script>

<Accordion.Item {...restProps}>
	<Accordion.Header class="flex items-center">
		<div class="flex-grow">
			{@render header()}
		</div>
		<Accordion.Trigger class="bg-secondary-700 cursor-pointer p-3">
			<CaretDownIcon />
		</Accordion.Trigger>
	</Accordion.Header>
	<Accordion.Content>
		{@render children?.()}
	</Accordion.Content>
</Accordion.Item>
