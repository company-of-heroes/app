<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ToggleGroup } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import { pageTab } from '@company-of-heroes/ui/variants';
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
		/** `segmented`: options inside one frame (default). `tabs`: separate bold page tabs. */
		variant?: 'segmented' | 'tabs';
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
		variant = 'segmented',
		class: className,
		item: itemContent,
		...restProps
	}: Props = $props();

	const itemClass = $derived(
		size === 'sm' ? 'h-6 px-2 text-xs font-semibold tracking-wide uppercase' : 'h-6.5 px-3 text-sm'
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
		variant === 'tabs'
			? 'inline-flex flex-wrap items-center gap-1.5'
			: 'border-secondary-700 bg-secondary-950 inline-flex items-center gap-0.5 rounded-md border p-[2px]',
		className
	)}
>
	{#each items as item (item.value)}
		<ToggleGroup.Item
			value={item.value}
			class={variant === 'tabs'
				? pageTab
				: cn(
						itemClass,
						// Each option reads as a button: ghost when idle, a lighter secondary fill when selected
						// that grows in from the centre (a `::before` layer behind the label).
						'text-secondary-300 relative isolate inline-flex shrink-0 items-center gap-2 rounded font-medium whitespace-nowrap transition-colors duration-150',
						'cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
						'not-disabled:hover:bg-secondary-800/25 not-disabled:hover:text-white',
						'before:bg-secondary-800 before:absolute before:inset-0 before:-z-10 before:rounded',
						'before:scale-0 before:opacity-0 before:transition-[scale,opacity] before:duration-150 before:ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:before:transition-none',
						'data-[state=on]:text-white data-[state=on]:before:scale-100 data-[state=on]:before:opacity-100'
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
