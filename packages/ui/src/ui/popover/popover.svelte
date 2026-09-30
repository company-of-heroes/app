<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { dropdownPanel } from '../../variants';
	import { Popover as PopoverPrimitive, type WithoutChildren } from 'bits-ui';
	import type { Snippet } from 'svelte';

	export type PopoverProps = {
		trigger: Snippet<[{ props: Record<string, unknown> }]>;
		children: Snippet;
		side?: PopoverPrimitive.ContentProps['side'];
		align?: PopoverPrimitive.ContentProps['align'];
		sideOffset?: PopoverPrimitive.ContentProps['sideOffset'];
		contentClass?: string;
	} & WithoutChildren<PopoverPrimitive.RootProps>;

	let {
		trigger,
		children,
		side,
		align,
		sideOffset = 8,
		contentClass,
		open = $bindable(false),
		...restProps
	}: PopoverProps = $props();
</script>

<PopoverPrimitive.Root bind:open {...restProps}>
	<PopoverPrimitive.Trigger>
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</PopoverPrimitive.Trigger>
	<PopoverPrimitive.Portal>
		<PopoverPrimitive.Content
			class={cn(
				dropdownPanel,
				'z-50',
				'data-[state=open]:animate-in data-[state=open]:fade-in-0',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:fill-mode-forwards',
				'data-[side=right]:data-[state=open]:slide-in-from-left-2',
				'data-[side=left]:data-[state=open]:slide-in-from-right-2',
				'data-[side=top]:data-[state=open]:slide-in-from-bottom-2',
				'data-[side=bottom]:data-[state=open]:slide-in-from-top-2',
				'duration-150',
				contentClass ?? 'max-w-[608px] px-4 py-2'
			)}
			{side}
			{align}
			{sideOffset}
		>
			{@render children()}
		</PopoverPrimitive.Content>
	</PopoverPrimitive.Portal>
</PopoverPrimitive.Root>
