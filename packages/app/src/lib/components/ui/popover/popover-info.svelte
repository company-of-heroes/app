<script lang="ts">
	import { cn } from '$lib/utils';
	import { Popover as PopoverPrimitive, type WithoutChildren } from 'bits-ui';
	import QuestionMark from 'phosphor-svelte/lib/QuestionMark';
	import type { Snippet } from 'svelte';
	import Popover from './popover.svelte';

	type Props = {
		children: Snippet;
		side?: PopoverPrimitive.ContentProps['side'];
		size?: 'sm' | 'normal';
	} & WithoutChildren<PopoverPrimitive.RootProps>;

	let { children, side = 'right', size = 'normal', ...restProps }: Props = $props();
</script>

<Popover {side} {...restProps} contentClass="max-w-[420px] px-4 py-2">
	{#snippet trigger({ props })}
		<button
			{...props}
			class={cn(
				'flex size-7 items-center justify-center rounded-full',
				'bg-secondary-700 cursor-pointer transition-colors',
				'data-[state=open]:bg-primary/10',
				size === 'sm' && 'size-5'
			)}
		>
			<QuestionMark size={size === 'sm' ? 14 : 20} />
		</button>
	{/snippet}
	{#snippet children()}
		{@render children()}
	{/snippet}
</Popover>
