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
	};

	let { value = $bindable(), items }: Props = $props();
</script>

<ToggleGroup.Root
	type="single"
	bind:value
	class={cn('border-secondary-700 flex items-center gap-1 rounded-md border p-1')}
>
	{#each items as item}
		<ToggleGroup.Item
			value={item.value}
			class={cn(
				'h-8 rounded px-2.5',
				'not-disabled:hover:bg-secondary-950 not-disabled:hover:cursor-pointer',
				'data-[state=on]:text-primary data-[state=on]:bg-gray-600'
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
