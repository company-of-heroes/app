<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ToggleGroup, type ToggleGroupRootProps } from 'bits-ui';
	import { cn } from '$lib/utils';

	type Props = {
		value: string;
		items: {
			value: string;
			label: Snippet | string;
		}[];
		type?: 'single' | 'multiple';
	} & Omit<ToggleGroupRootProps, 'type' | 'value' | 'value' | 'children'>;

	let { value = $bindable(), items, ...restProps }: Props = $props();
</script>

<ToggleGroup.Root
	type="single"
	bind:value
	class={cn(
		'border-secondary-700 flex items-center overflow-clip rounded-md border',
		restProps.class
	)}
>
	{#each items as item}
		<ToggleGroup.Item
			value={item.value}
			class={cn(
				'h-10 px-4 transition-colors',
				'not-disabled:hover:bg-secondary-950/50 not-disabled:hover:cursor-pointer',
				'data-[state=on]:text-primary data-[state=on]:bg-secondary-950 data-[state=on]:hover:bg-secondary-900'
			)}
		>
			{#if typeof item.label === 'string'}
				{item.label}
			{:else}
				{@render item.label()}
			{/if}
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>
