<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		adornedControl,
		adornedInput,
		adornedTrailing,
		interactive
	} from '../../variants';

	export type CompareOperatorOption = {
		value: string;
		label: string;
	};

	export type CompareInputProps = {
		value?: string;
		operator?: string;
		operators: CompareOperatorOption[];
		operatorLabel?: string;
		size?: 'sm' | 'md' | 'lg';
		trailing?: Snippet;
		class?: string;
		onOperatorChange?: (operator: string) => void;
	} & Omit<HTMLInputAttributes, 'size' | 'value' | 'type'>;

	let {
		value = $bindable(''),
		operator = $bindable(''),
		operators,
		operatorLabel = 'Change operator',
		size = 'md',
		trailing,
		class: className,
		onOperatorChange,
		...restProps
	}: CompareInputProps = $props();

	/** Match Selection trigger heights; sm uses h-9 so it aligns with controlBase beside filters. */
	const controlSize = $derived(
		size === 'sm' ? 'h-9 min-h-9 text-sm' : size === 'lg' ? 'h-14 min-h-14 text-lg' : 'h-11 min-h-11 text-base'
	);
	const adornedText = $derived(size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base');
	const adornedSidePad = $derived(size === 'sm' ? 'px-2' : 'px-3');

	function selectOperator(next: string) {
		operator = next;
		onOperatorChange?.(next);
	}

	function onOperatorKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
			return;
		}

		event.preventDefault();
		const index = operators.findIndex((option) => option.value === operator);
		const current = index >= 0 ? index : 0;
		const delta = event.key === 'ArrowRight' ? 1 : -1;
		const nextIndex = (current + delta + operators.length) % operators.length;
		const next = operators[nextIndex];
		if (!next) {
			return;
		}

		selectOperator(next.value);
		const target = event.currentTarget;
		if (target instanceof HTMLElement) {
			const button = target.querySelector<HTMLElement>(
				`[role="radio"][data-value="${CSS.escape(next.value)}"]`
			);
			button?.focus();
		}
	}
</script>

<div class={cn(adornedControl, controlSize, 'w-full min-w-0 shrink-0', className)}>
	<div
		role="radiogroup"
		aria-label={operatorLabel}
		tabindex="-1"
		class="border-secondary-800 flex h-full shrink-0 items-stretch border-r"
		onkeydown={onOperatorKeydown}
	>
		{#each operators as option (option.value)}
			<button
				type="button"
				role="radio"
				data-value={option.value}
				aria-checked={operator === option.value}
				tabindex={operator === option.value ? 0 : -1}
				class={cn(
					interactive,
					'flex h-full items-center justify-center px-2 leading-none',
					'text-secondary-400 hover:bg-secondary-950/50',
					'aria-checked:bg-secondary-950 aria-checked:text-primary'
				)}
				onclick={() => selectOperator(option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
	<input
		bind:value
		{...restProps}
		type="text"
		class={cn(adornedInput, adornedText, 'h-full min-h-0 leading-none')}
	/>
	{#if trailing}
		<span class={cn(adornedTrailing, adornedSidePad, 'h-full')}>
			{@render trailing()}
		</span>
	{/if}
</div>
