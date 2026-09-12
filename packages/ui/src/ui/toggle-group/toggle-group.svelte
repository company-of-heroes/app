<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ToggleGroup, type ToggleGroupRootProps } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import { watch } from 'runed';

	function isEmpty(value: string) {
		return value == null || value === '';
	}

	type Props = {
		value: string;
		items: {
			value: string;
			label: Snippet | string;
		}[];
		type?: 'single' | 'multiple';
		size?: 'sm' | 'md';
		class?: string;
	} & Omit<ToggleGroupRootProps, 'type' | 'value' | 'children' | 'class'>;

	let {
		value = $bindable(),
		items,
		size = 'md',
		class: className,
		...restProps
	}: Props = $props();

	const itemClass = $derived(
		size === 'sm'
			? 'h-7 px-3 text-xs font-semibold tracking-wide uppercase'
			: 'h-11 px-4'
	);

	watch(
		() => value,
		(curr, prev) => {
			if (isEmpty(curr) && items.length > 0) {
				value = prev ?? items[0].value;
			}
		}
	);
</script>

<ToggleGroup.Root
	type="single"
	bind:value
	{...restProps}
	class={cn(
		'border-secondary-700 flex items-center overflow-clip rounded-md border',
		className
	)}
>
	{#each items as item (item.value)}
		<ToggleGroup.Item
			value={item.value}
			class={cn(
				itemClass,
				'transition-colors',
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
