<script lang="ts">
	import type { Snippet } from 'svelte';
	import { DropdownMenu } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { surfacePanel } from '../variants';

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
				surfacePanel,
				'w-[229px] p-1 shadow-lg',
				'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
				'duration-150',
				restProps.class
			)}
			sideOffset={8}
		>
			{@render children?.()}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
