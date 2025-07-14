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
	class={cn('border-secondary-700 flex items-center gap-[2px] border p-[2px]')}
>
	{#each items as item}
		<ToggleGroup.Item
			value={item.value}
			class={cn(
				'bg-secondary-900 h-8 px-2.5',
				'hover:bg-secondary-800 hover:cursor-pointer',
				'data-[state=on]:bg-primary/15 data-[state=on]:text-white'
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
