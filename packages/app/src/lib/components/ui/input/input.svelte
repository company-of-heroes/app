<script lang="ts">
	import { untrack } from 'svelte';
	import type { InputProps } from '.';
	import { cn } from '$lib/utils';
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
		stepperButton
	} from '../variants';
	import { Button } from '../button';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import MinusIcon from 'phosphor-svelte/lib/Minus';

	let {
		value = $bindable(),
		type,
		class: className,
		leading,
		trailing,
		...restProps
	}: InputProps = $props();
	let showPasswordToggle = $state(untrack(() => type === 'password'));
	let hasAdornments = $derived(leading != null || trailing != null);

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

{#if type === 'number'}
	<div
		class={cn(hasAdornments ? cn(adornedControl, adornedControlDisabled) : 'relative w-full', className)}
	>
		{#if leading}
			<span class={cn(adornedLeading, 'pointer-events-none')}>
				{@render leading()}
			</span>
		{/if}
		<input
			bind:value
			{...restProps}
			type="text"
			inputmode="numeric"
			class={cn(
				hasAdornments ? adornedInput : cn(controlBase, 'w-full px-4 pe-[4.25rem]'),
				controlDisabled,
				controlReadonly
			)}
			oninput={() => {
				value = value.replace(/[^0-9.-]/g, '');
			}}
		/>
		{#if trailing}
			<span class={adornedTrailing}>
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
				aria-label="Decrease value"
				onclick={() => stepValue(-1)}
			>
				<MinusIcon size={12} weight="bold" />
			</button>
			<button
				type="button"
				class={stepperButton}
				aria-label="Increase value"
				onclick={() => stepValue(1)}
			>
				<PlusIcon size={12} weight="bold" />
			</button>
		</div>
	</div>
{:else if hasAdornments}
	<div class={cn(adornedControl, adornedControlDisabled, className)}>
		{#if leading}
			<span class={cn(adornedLeading, 'pointer-events-none')}>
				{@render leading()}
			</span>
		{/if}
		<input
			bind:value
			{...restProps}
			{type}
			class={cn(adornedInput, controlDisabled, controlReadonly)}
		/>
		{#if trailing}
			<span class={adornedTrailing}>
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
	<div class={cn('relative w-full', className)}>
		<input
			bind:value
			{...restProps}
			{type}
			class={cn(controlBase, 'w-full px-4', controlDisabled, controlReadonly)}
		/>
		{#if showPasswordToggle}
			<Button
				variant="ghost"
				size="icon-sm"
				type="button"
				class="text-secondary-400 absolute top-1.5 right-1.5"
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
