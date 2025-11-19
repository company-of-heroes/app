<script lang="ts">
	import { cn } from '$lib/utils';
	import { Popover, type WithoutChildren } from 'bits-ui';
	import QuestionMark from 'phosphor-svelte/lib/QuestionMark';
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		side?: Popover.ContentProps['side'];
		size?: 'sm' | 'normal';
	} & WithoutChildren<Popover.RootProps>;

	let { children, side = 'right', size = 'normal', ...restProps }: Props = $props();
</script>

<Popover.Root {...restProps}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				class={cn(
					'flex size-7 items-center justify-center rounded-full',
					'cursor-pointer bg-gray-700 transition-colors',
					'data-[state=open]:bg-primary/10',
					size === 'sm' && 'size-5'
				)}
			>
				<QuestionMark size={size === 'sm' ? 14 : 20} />
			</button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			class={cn(
				'z-50 max-w-[420px] rounded-lg border border-gray-600 bg-gray-900 px-4 py-2 shadow-lg'
			)}
			sideOffset={8}
			{side}
		>
			{@render children()}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
