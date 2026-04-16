<script lang="ts">
	import { cn } from '$lib/utils';
	import { ScrollArea, type WithoutChild } from 'bits-ui';

	type Props = WithoutChild<ScrollArea.RootProps> & {
		orientation?: 'vertical' | 'horizontal' | 'both';
		heigth?: string; // Tailwind CSS class for height
	};

	let {
		ref = $bindable(null),
		orientation = 'vertical',
		heigth = 'max-h-[400px]',
		children,
		...restProps
	}: Props = $props();
</script>

{#snippet Scrollbar({ orientation }: { orientation: 'vertical' | 'horizontal' })}
	<ScrollArea.Scrollbar {orientation} class="w-2">
		<ScrollArea.Thumb class="w-2 cursor-pointer bg-gray-950" />
	</ScrollArea.Scrollbar>
{/snippet}

<ScrollArea.Root bind:ref {...restProps} type="always">
	<ScrollArea.Viewport class={cn(heigth)}>
		{@render children?.()}
	</ScrollArea.Viewport>
	{#if orientation === 'vertical' || orientation === 'both'}
		{@render Scrollbar({ orientation: 'vertical' })}
	{/if}
	{#if orientation === 'horizontal' || orientation === 'both'}
		{@render Scrollbar({ orientation: 'horizontal' })}
	{/if}
	<ScrollArea.Corner />
</ScrollArea.Root>
