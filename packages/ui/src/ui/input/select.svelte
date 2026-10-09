<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Select, type WithoutChildren } from 'bits-ui';
	import type { Snippet } from 'svelte';
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
		/** Custom content for an option, in the list and in the trigger (avatar, flag, …); falls back to `label`. */
		item?: Snippet<[SelectItem]>;
		/** Accessible name of the trigger button. */
		'aria-label'?: string;
	};

	const { t } = useI18n();

	let {
		value = $bindable(),
		items,
		contentProps,
		placeholder,
		class: className,
		flush = false,
		size = 'md',
		type = 'single',
		empty = t('No results found.'),
		selectedCountLabel = (count: number) => t('{count} items', { count }),
		item: itemContent,
		'aria-label': ariaLabel,
		...restProps
	}: SelectProps = $props();

	const itemSize = $derived(!flush && size === 'sm' ? 'text-sm' : 'text-base');
	const current = $derived(items.find((item) => item.value === value));
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
							'group flex w-full min-w-28 cursor-pointer items-center justify-between truncate px-3 text-left disabled:cursor-not-allowed'
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
	<Select.Trigger class={triggerClass} aria-label={ariaLabel}>
		{#if Array.isArray(value) && value.length}
			{selectedCountLabel(value.length)}
		{:else if current && itemContent}
			<span class="flex min-w-0 items-center gap-2 truncate">{@render itemContent(current)}</span>
		{:else}
			{current?.label ?? placeholder}
		{/if}
		<CaretDownIcon class="ms-2 shrink-0 group-data-[state=open]:rotate-180" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			align="start"
			side="bottom"
			sideOffset={4}
			{...contentProps}
			class={cn(
				'z-50 max-h-64 w-max min-w-[max(var(--bits-select-anchor-width),10rem)] rounded-md border p-1',
				'border-secondary-700 bg-secondary-950 shadow-lg shadow-black/30',
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
						class={cn(
							menuItem,
							'text-secondary-400 flex h-8 cursor-default items-center py-0 font-medium disabled:cursor-not-allowed',
							itemSize
						)}
					>
						{empty}
					</Select.Item>
				{:else}
					{#each items as option (option.value)}
						<Select.Item
							value={option.value}
							label={option.label}
							disabled={option.disabled}
							class={cn(
								menuItem,
								'flex h-8 w-full items-center gap-4 py-0 font-medium data-[selected]:text-white',
								itemSize
							)}
						>
							{#snippet children({ selected }: any)}
								{#if itemContent}
									<span class="flex min-w-0 items-center gap-2">{@render itemContent(option)}</span>
								{:else}
									{option.label}
								{/if}
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
