<script lang="ts">
	import { RadioGroup, useId, type WithoutChildrenOrChild } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { Label } from '../label';

	type Item = {
		value: string;
		label: string;
		disabled?: boolean;
	};

	type Props = WithoutChildrenOrChild<RadioGroup.RootProps> & {
		items: Item[];
		direction?: 'horizontal' | 'vertical';
	};

	let {
		value = $bindable(''),
		ref = $bindable(null),
		items,
		direction = 'vertical',
		...restProps
	}: Props = $props();
</script>

<RadioGroup.Root
	bind:value
	bind:ref
	{...restProps}
	class={cn(
		'flex gap-2',
		direction === 'horizontal' && 'gap-6',
		direction === 'vertical' && 'flex-col',
		restProps.class
	)}
>
	{#each items as item}
		{@const id = useId()}
		<div class="flex items-center gap-2">
			<RadioGroup.Item
				{id}
				value={item.value}
				disabled={item.disabled}
				class={cn(
					'border-secondary-900 flex size-5 shrink-0 items-center justify-center overflow-clip rounded-md border-2',
					item.disabled && 'cursor-not-allowed opacity-50',
					value === item.value && 'border-secondary-100'
				)}
			>
				{#snippet children({ checked })}
					{#if checked}
						<span class="bg-secondary-100 size-3 shrink-0 rounded-full"></span>
					{:else}
						<span class="bg-dark size-3 shrink-0 rounded-full"></span>
					{/if}
				{/snippet}
			</RadioGroup.Item>
			<Label for={id}>{item.label}</Label>
		</div>
	{/each}
</RadioGroup.Root>
