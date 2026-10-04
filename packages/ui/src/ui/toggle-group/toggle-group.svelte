<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ToggleGroup } from 'bits-ui';
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
		size?: 'sm' | 'md';
		class?: string;
		/** Custom content per item (e.g. icon + label); falls back to `label`. */
		item?: Snippet<[{ value: string; label: Snippet | string }]>;
		onValueChange?: (value: string) => void;
		disabled?: boolean;
		'aria-label'?: string;
	};

	let {
		value = $bindable(),
		items,
		size = 'md',
		class: className,
		item: itemContent,
		...restProps
	}: Props = $props();

	const itemClass = $derived(
		size === 'sm' ? 'h-6 px-2 text-xs font-semibold tracking-wide uppercase' : 'h-7 px-3 text-sm'
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
		'border-secondary-800 bg-secondary-950/60 inline-flex items-center rounded-md border',
		'gap-0.5 p-[2px]',
		className
	)}
>
	{#each items as item (item.value)}
		<ToggleGroup.Item
			value={item.value}
			class={cn(
				itemClass,
				// Each option reads as a button: ghost when idle, a lighter secondary fill when selected.
				'text-secondary-300 inline-flex shrink-0 items-center gap-2 rounded font-medium whitespace-nowrap transition-colors duration-150',
				'cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
				'not-disabled:hover:bg-secondary-800/70 not-disabled:hover:text-white',
				'data-[state=on]:bg-secondary-800 data-[state=on]:not-disabled:hover:bg-secondary-800 data-[state=on]:text-white'
			)}
		>
			{#if itemContent}
				{@render itemContent(item)}
			{:else if typeof item.label === 'string'}
				{item.label}
			{:else}
				{@render item.label()}
			{/if}
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>
