<script lang="ts">
	import type { Snippet } from 'svelte';
	import { DropdownMenu } from 'bits-ui';
	import { cn } from '$lib/utils';

	type Props = DropdownMenu.RootProps & {
		trigger: Snippet<[{ props: DropdownMenu.TriggerProps }]>;
		children: Snippet;
		class?: string;
	};

	let { trigger, children, ...restProps }: Props = $props();
</script>

<DropdownMenu.Root {...restProps}>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			side="bottom"
			align="start"
			class={cn(
				'w-[229px] rounded-md border border-gray-600 bg-gray-800 p-1 shadow-lg',
				restProps.class
			)}
			sideOffset={8}
		>
			{@render children?.()}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
