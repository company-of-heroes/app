<script lang="ts">
	import { untrack } from 'svelte';
	import type { InputProps } from '.';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		adornedActions,
		adornedControl,
		adornedControlDisabled,
		adornedInput,
		adornedLeading,
		adornedTrailing,
		controlBase,
		controlDisabled,
		controlReadonly,
		flushInput,
		stepperButton
	} from '../../variants';
	import { Button } from '../button';
	import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlashIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import MinusIcon from 'phosphor-svelte/lib/MinusIcon';

	let {
		value = $bindable(),
		type,
		class: className,
		leading,
		trailing,
		flush = false,
		size = 'md',
		decreaseLabel = 'Decrease value',
		increaseLabel = 'Increase value',
		inputClasses = '',
		...restProps
	}: InputProps = $props();
	let showPasswordToggle = $state(untrack(() => type === 'password'));
	let hasAdornments = $derived(leading != null || trailing != null);
	const hasExtras = $derived(
		leading != null || trailing != null || showPasswordToggle || type === 'number'
	);
	const controlSize = $derived(
		size === 'sm' ? 'h-8 text-sm' : size === 'lg' ? 'h-14 text-lg' : 'h-9 text-base'
	);
	const controlPad = $derived(size === 'sm' ? 'px-3' : size === 'lg' ? 'px-5' : 'px-4');
	const adornedText = $derived(size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base');
	const adornedSidePad = $derived(size === 'sm' ? 'px-2' : 'px-3');
	const numberEndPad = $derived(size === 'sm' ? 'pe-14' : 'pe-17');
	const passwordEndPad = $derived(size === 'sm' ? 'pe-9' : 'pe-11');
	const passwordTogglePos = $derived(
		size === 'sm' ? 'top-1/2 right-0.5 -translate-y-1/2' : 'top-1/2 right-1.5 -translate-y-1/2'
	);
	const flushText = $derived(size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base');

	function stepValue(direction: 1 | -1) {
		const step = restProps.step ? parseFloat(restProps.step.toString()) : 1;
		let next = (parseFloat(value) || 0) + direction * step;
		if (restProps.max !== undefined && next > parseFloat(restProps.max?.toString() ?? '0')) {
			next = parseFloat(restProps.max?.toString() ?? '0');
		}

		if (restProps.min !== undefined && next < parseFloat(restProps.min?.toString() ?? '0')) {
			next = parseFloat(restProps.min?.toString() ?? '0');
		}

		value = next.toString();
	}
</script>

{#if flush}
	{#if hasExtras}
		<div class={cn('flex min-w-0 flex-1 items-center gap-2', className)}>
			{#if leading}
				<span class="text-secondary-500 pointer-events-none shrink-0">
					{@render leading()}
				</span>
			{/if}
			<input
				bind:value
				{...restProps}
				type={type === 'number' ? 'text' : type}
				inputmode={type === 'number' ? 'numeric' : restProps.inputmode}
				class={cn(flushInput, flushText, controlDisabled, controlReadonly, inputClasses)}
				oninput={type === 'number'
					? () => {
							value = String(value).replace(/[^0-9.-]/g, '');
						}
					: restProps.oninput}
			/>
			{#if trailing}
				<span class="text-secondary-500 shrink-0">
					{@render trailing()}
				</span>
			{/if}
			{#if type === 'number'}
				<div class="flex shrink-0 items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						class="text-secondary-400"
						aria-label={decreaseLabel}
						onclick={() => stepValue(-1)}
					>
						<MinusIcon size={12} weight="bold" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						class="text-secondary-400"
						aria-label={increaseLabel}
						onclick={() => stepValue(1)}
					>
						<PlusIcon size={12} weight="bold" />
					</Button>
				</div>
			{:else if showPasswordToggle}
				<Button
					variant="ghost"
					size="icon-sm"
					type="button"
					class="text-secondary-400 shrink-0"
					onclick={() => (type = type === 'password' ? 'text' : 'password')}
				>
					{#if type === 'password'}
						<EyeSlashIcon />
					{:else}
						<EyeIcon />
					{/if}
				</Button>
			{/if}
		</div>
	{:else}
		<input
			bind:value
			{...restProps}
			{type}
			class={cn(flushInput, flushText, controlDisabled, controlReadonly, className)}
		/>
	{/if}
{:else if type === 'number'}
	<div
		class={cn(
			hasAdornments ? cn(adornedControl, adornedControlDisabled, controlSize) : 'relative w-full',
			'min-w-0 flex-1',
			className
		)}
	>
		{#if leading}
			<span class={cn(adornedLeading, adornedSidePad, 'pointer-events-none')}>
				{@render leading()}
			</span>
		{/if}
		<input
			bind:value
			{...restProps}
			type="text"
			inputmode="numeric"
			class={cn(
				hasAdornments
					? cn(adornedInput, adornedText)
					: cn(controlBase, controlSize, 'w-full', controlPad, numberEndPad),
				controlDisabled,
				controlReadonly,
				inputClasses
			)}
			oninput={() => {
				value = String(value).replace(/[^0-9.-]/g, '');
			}}
		/>
		{#if trailing}
			<span class={cn(adornedTrailing, adornedSidePad)}>
				{@render trailing()}
			</span>
		{/if}
		<div
			class={cn(
				'flex items-center gap-1',
				hasAdornments ? adornedActions : 'absolute top-1/2 right-1.5 -translate-y-1/2'
			)}
		>
			<button
				type="button"
				class={stepperButton}
				aria-label={decreaseLabel}
				onclick={() => stepValue(-1)}
			>
				<MinusIcon size={12} weight="bold" />
			</button>
			<button
				type="button"
				class={stepperButton}
				aria-label={increaseLabel}
				onclick={() => stepValue(1)}
			>
				<PlusIcon size={12} weight="bold" />
			</button>
		</div>
	</div>
{:else if hasAdornments}
	<div class={cn(adornedControl, adornedControlDisabled, controlSize, 'min-w-0 flex-1', className)}>
		{#if leading}
			<span class={cn(adornedLeading, adornedSidePad, 'pointer-events-none')}>
				{@render leading()}
			</span>
		{/if}
		<input
			bind:value
			{...restProps}
			{type}
			class={cn(adornedInput, adornedText, controlDisabled, controlReadonly, inputClasses)}
		/>
		{#if trailing}
			<span class={cn(adornedTrailing, adornedSidePad)}>
				{@render trailing()}
			</span>
		{/if}
		{#if showPasswordToggle}
			<Button
				variant="ghost"
				size="icon-sm"
				type="button"
				class="text-secondary-400 border-secondary-800 shrink-0 border-l"
				onclick={() => (type = type === 'password' ? 'text' : 'password')}
			>
				{#if type === 'password'}
					<EyeSlashIcon />
				{:else}
					<EyeIcon />
				{/if}
			</Button>
		{/if}
	</div>
{:else}
	<div class={cn('relative w-full min-w-0 flex-1', className)}>
		<input
			bind:value
			{...restProps}
			{type}
			class={cn(
				controlBase,
				controlSize,
				'w-full',
				controlPad,
				showPasswordToggle && passwordEndPad,
				controlDisabled,
				controlReadonly,
				inputClasses
			)}
		/>
		{#if showPasswordToggle}
			<Button
				variant="ghost"
				size="icon-sm"
				type="button"
				class={cn('text-secondary-400 absolute', passwordTogglePos)}
				onclick={() => (type = type === 'password' ? 'text' : 'password')}
			>
				{#if type === 'password'}
					<EyeSlashIcon />
				{:else}
					<EyeIcon />
				{/if}
			</Button>
		{/if}
	</div>
{/if}
