<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { onMount, tick, type Snippet } from 'svelte';
	import { Button } from '../button';
	import { cn } from '$lib/utils';
	import X from 'phosphor-svelte/lib/X';
	import CheckIcon from 'phosphor-svelte/lib/Check';

	type Props = {
		options: { value: string; label: string }[];
		open?: boolean;
		placeholder?: string;
		multiple?: boolean;
		icon?: Snippet;
	} & HTMLInputAttributes;

	let {
		value = $bindable(),
		open = $bindable(false),
		options,
		placeholder = 'Select an option...',
		multiple = false,
		icon
	}: Props = $props();

	let search = $state('');
	let highlightedIndex = $state(0);
	let searchInput = $state<HTMLInputElement | null>(null);
	let listItems = $state<HTMLButtonElement[]>([]);
	let displayedCount = $state(50);

	// Ensure value is array for multiple mode, string for single mode
	let selectedValues = $derived.by(() => {
		if (multiple) {
			return Array.isArray(value) ? value : value ? [value] : [];
		}
		return [];
	});

	let filteredOptions = $derived.by(() => {
		if (search.trim() === '') {
			return options;
		}
		return options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()));
	});

	let displayedOptions = $derived(filteredOptions.slice(0, displayedCount));

	$effect(() => {
		search;
		displayedCount = 50;
	});

	let displayText = $derived.by(() => {
		if (multiple) {
			const selected = selectedValues;
			if (selected.length === 0) return placeholder;
			if (selected.length === 1) {
				return options.find((opt) => opt.value === selected[0])?.label || placeholder;
			}
			return `${selected.length} selected`;
		} else {
			return value ? options.find((option) => option.value === value)?.label : placeholder;
		}
	});

	// Reset highlighted index when filtered options change
	$effect(() => {
		if (filteredOptions.length > 0 && highlightedIndex >= filteredOptions.length) {
			highlightedIndex = 0;
		}
	});

	// Focus search input when dropdown opens
	$effect(() => {
		if (open && searchInput) {
			searchInput.focus();
		}
	});

	function isSelected(optionValue: string): boolean {
		if (multiple) {
			return selectedValues.includes(optionValue);
		}
		return value === optionValue;
	}

	function selectOption(option: { value: string; label: string }) {
		if (multiple) {
			const currentValues = selectedValues;
			if (currentValues.includes(option.value)) {
				// Remove from selection
				value = currentValues.filter((v) => v !== option.value);
			} else {
				// Add to selection
				value = [...currentValues, option.value];
			}
			// Don't close dropdown in multiple mode
		} else {
			value = option.value;
			open = false;
			search = '';
			highlightedIndex = 0;
		}
	}

	function removeValue(valueToRemove: string, event: Event) {
		event.stopPropagation();
		if (multiple) {
			value = selectedValues.filter((v) => v !== valueToRemove);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;

		switch (event.key) {
			case 'Escape':
				open = false;
				search = '';
				highlightedIndex = 0;
				break;
			case 'ArrowDown':
				event.preventDefault();
				highlightedIndex = (highlightedIndex + 1) % filteredOptions.length;
				scrollToHighlighted();
				break;
			case 'ArrowUp':
				event.preventDefault();
				highlightedIndex =
					highlightedIndex === 0 ? filteredOptions.length - 1 : highlightedIndex - 1;
				scrollToHighlighted();
				break;
			case 'Enter':
				event.preventDefault();
				if (filteredOptions.length > 0) {
					selectOption(filteredOptions[highlightedIndex]);
				}
				break;
			case 'Tab':
				if (filteredOptions.length > 0) {
					event.preventDefault();
					selectOption(filteredOptions[highlightedIndex]);
				}
				break;
		}
	}

	function handleBackdropKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			open = false;
			search = '';
			highlightedIndex = 0;
		}
	}

	async function scrollToHighlighted() {
		if (highlightedIndex >= displayedCount) {
			displayedCount = highlightedIndex + 50;
			await tick();
		}
		const highlightedElement = listItems[highlightedIndex];
		if (highlightedElement) {
			highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}
	}

	function viewport(node: HTMLElement) {
		const observer = new IntersectionObserver((entries) => {
			if (entries[0].isIntersecting) {
				displayedCount += 50;
			}
		});
		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}
</script>

{#if multiple && selectedValues.length > 0}
	<div class="flex flex-wrap items-start gap-1">
		<button
			class="me-4 mt-2 cursor-pointer text-sm font-medium text-red-400 transition-colors hover:text-red-300"
			onclick={() => {
				selectedValues = [];
				value = multiple ? [] : '';
			}}
			type="button"
		>
			Clear All
		</button>
		{#each selectedValues as value}
			{@const opt = options.find((o) => o.value === value)}
			{#if opt}
				<span
					class={cn(
						'grid w-fit grid-flow-col items-center gap-4 rounded border py-1.5 ps-4 pe-3 text-sm',
						'border-gray-600 bg-gray-700 shadow-2xs',
						'hover:bg-gray-600'
					)}
				>
					<span class="truncate">{opt.label}</span>
					<button
						class="ms-auto cursor-pointer hover:text-red-400"
						type="button"
						onclick={(e) => removeValue(value, e)}
					>
						<X />
					</button>
				</span>
			{/if}
		{/each}
	</div>
{/if}

<Button type="button" onclick={() => (open = true)} class="w-fit max-w-48" variant="secondary">
	{#if icon}
		<span class="size-fit">{@render icon()}</span>
	{/if}
	<span class="truncate">{displayText}</span>
</Button>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		class="fixed inset-0 z-50 grid h-screen w-screen justify-center bg-gray-950/40 backdrop-blur-xl"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				open = false;
				search = '';
				highlightedIndex = 0;
			}
		}}
		onkeydown={handleBackdropKeydown}
	>
		<div class="mt-24 max-h-80 w-lg">
			<input
				type="text"
				bind:this={searchInput}
				class={cn(
					'rounded-tl-md rounded-tr-md border-t border-r border-b border-l',
					'w-full border-gray-600 bg-gray-900 px-4 py-3 outline-none'
				)}
				placeholder="Search..."
				bind:value={search}
				onkeydown={handleKeydown}
			/>
			<ul
				class="max-h-60 overflow-y-auto rounded-br-md rounded-bl-md border border-t-0 border-gray-600 bg-gray-900"
				role="listbox"
			>
				{#each displayedOptions as option, index}
					<button
						bind:this={listItems[index]}
						class={cn(
							'flex w-full cursor-pointer items-center gap-4 px-5 py-3 transition-colors hover:bg-gray-700',
							highlightedIndex === index && 'bg-gray-800'
						)}
						onclick={() => selectOption(option)}
						onmouseenter={() => (highlightedIndex = index)}
						role="option"
						aria-selected={highlightedIndex === index}
					>
						{#if multiple}
							<span
								class={cn(
									'flex size-6 items-center justify-center rounded border border-gray-600 p-1',
									isSelected(option.value) && 'bg-gray-600'
								)}
							>
								{#if isSelected(option.value)}
									<CheckIcon weight="bold" />
								{/if}
							</span>
						{/if}
						{option.label}
					</button>
				{/each}
				<div use:viewport class="h-px w-full"></div>
			</ul>
		</div>
	</div>
{/if}
