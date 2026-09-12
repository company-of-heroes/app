<script lang="ts">
	import { Select, type WithoutChildren } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import { controlBase, flushSelect, menuItem } from '../../variants';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';

	export type SelectItem = {
		value: string;
		label: string;
		disabled?: boolean;
	};

	export type SelectProps = WithoutChildren<Select.RootProps> & {
		placeholder?: string;
		items: SelectItem[];
		contentProps?: WithoutChildren<Select.ContentProps>;
		class?: string;
		flush?: boolean;
		size?: 'sm' | 'md';
		empty?: string;
		selectedCountLabel?: (count: number) => string;
	};

	let {
		value = $bindable(),
		items,
		contentProps,
		placeholder,
		class: className,
		flush = false,
		size = 'md',
		type = 'single',
		empty = 'No results found.',
		selectedCountLabel = (count: number) => `${count} items`,
		...restProps
	}: SelectProps = $props();

	const selectedLabel = $derived(items.find((item) => item.value === value)?.label);
	const triggerClass = $derived(
		cn(
			flush
				? cn(flushSelect, 'disabled:cursor-not-allowed')
				: size === 'sm'
					? cn(
							controlBase,
							'group flex h-8 w-full min-w-28 cursor-pointer items-center justify-between truncate px-3 text-left text-sm disabled:cursor-not-allowed'
						)
					: cn(
							controlBase,
							'group flex w-full min-w-28 cursor-pointer items-center justify-between truncate px-4 text-left disabled:cursor-not-allowed'
						),
			className
		)
	);
</script>

<!--
TypeScript Discriminated Unions + destructing (required for "bindable") do not
get along, so we shut typescript up by casting `value` to `never`, however,
from the perspective of the consumer of this component, it will be typed appropriately.
-->
<Select.Root {...restProps} type={type as never} bind:value={value as never}>
	<Select.Trigger class={triggerClass}>
		{Array.isArray(value) && value.length
			? selectedCountLabel(value.length)
			: selectedLabel
				? selectedLabel
				: placeholder}
		<CaretDownIcon class="ms-2 shrink-0 group-data-[state=open]:rotate-180" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			align="start"
			side="bottom"
			sideOffset={0}
			{...contentProps}
			class={cn(
				'overlay-surface border-secondary-800 z-50 max-h-64 w-max min-w-[max(var(--bits-select-anchor-width),10rem)] rounded-md border shadow-md',
				contentProps?.class
			)}
		>
			<Select.ScrollUpButton class="flex items-center justify-center py-1">
				<CaretUpIcon />
			</Select.ScrollUpButton>
			<Select.Viewport>
				{#if items.length === 0}
					<Select.Item
						value="__empty__"
						label={empty}
						disabled
						class={cn(menuItem, 'text-secondary-400 cursor-default disabled:cursor-not-allowed')}
					>
						{empty}
					</Select.Item>
				{:else}
					{#each items as { value, label, disabled } (value)}
						<Select.Item
							{value}
							{label}
							{disabled}
							class={cn(menuItem, 'flex w-full items-center gap-4')}
						>
							{#snippet children({ selected }: any)}
								{label}
								{#if selected}
									<CheckIcon class="ms-auto" weight="bold" />
								{/if}
							{/snippet}
						</Select.Item>
					{/each}
				{/if}
			</Select.Viewport>
			<Select.ScrollDownButton class="flex items-center justify-center py-1">
				<CaretDownIcon />
			</Select.ScrollDownButton>
		</Select.Content>
	</Select.Portal>
</Select.Root>
