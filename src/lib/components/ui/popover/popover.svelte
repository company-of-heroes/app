<script lang="ts">
	import { cn } from '$lib/utils';
	import { Popover, type WithoutChildren } from 'bits-ui';
	import type { Snippet } from 'svelte';

	type Props = {
		trigger: Snippet<[{ props: Record<string, unknown> }]>;
		children: Snippet;
	} & WithoutChildren<Popover.RootProps>;

	let { trigger, children, ...restProps }: Props = $props();
</script>

<Popover.Root {...restProps} open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<button {...props}>
				{@render trigger({ props })}
			</button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			class={cn(
				'z-50 max-w-[608px] rounded-lg border border-gray-600 bg-gray-900 px-4 py-2 shadow-lg'
			)}
		>
			{@render children()}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
