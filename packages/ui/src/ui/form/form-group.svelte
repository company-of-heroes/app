<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushBand,
		flushFooter,
		flushHeaderDescription,
		flushHeaderTitle,
		flushSectionTitle
	} from '../../variants';

	type Layout = 'field' | 'band' | 'stacked';

	type Props = {
		label?: string;
		inputId?: string;
		description?: string | Snippet;
		hint?: Snippet;
		footer?: Snippet;
		children?: Snippet;
		layout?: Layout;
		/** Drop max-w-xl so the field spans the page (e.g. markdown description). */
		wide?: boolean;
		/** Show a required marker next to the label. */
		required?: boolean;
		requiredLabel?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		label,
		inputId,
		description,
		hint,
		footer,
		children,
		layout = 'field',
		wide = false,
		required = false,
		requiredLabel = 'required',
		class: className,
		...restProps
	}: Props = $props();

	const descriptionText = $derived(typeof description === 'string' ? description : undefined);
	const descriptionSnippet = $derived(typeof description === 'function' ? description : undefined);
	const hasHeader = $derived(!!label || !!description || !!hint);
	const hasBody = $derived(!!children || !!footer);
	const titleClass = $derived(hasBody ? flushHeaderTitle : flushSectionTitle);
</script>

{#snippet fieldLabel()}
	{#if label}
		{#if inputId}
			<label for={inputId} class={titleClass}>
				{label}{#if required}<span class="text-destructive" aria-hidden="true">*</span><span class="sr-only"
						>({requiredLabel})</span
					>{/if}
			</label>
		{:else}
			<p class={titleClass}>
				{label}{#if required}<span class="text-destructive" aria-hidden="true">*</span><span class="sr-only"
						>({requiredLabel})</span
					>{/if}
			</p>
		{/if}
	{/if}
{/snippet}

<div {...restProps} class={cn('border-secondary-800 border-b', className)}>
	{#if hasHeader && layout === 'band'}
		<div class="px-4 py-3">
			{#if label || hint}
				<div class="flex w-full items-start gap-2">
					{@render fieldLabel()}
					{@render hint?.()}
				</div>
			{/if}
			{#if descriptionText || descriptionSnippet}
				<div class={flushHeaderDescription}>
					{#if descriptionText}
						{descriptionText}
					{:else}
						{@render descriptionSnippet?.()}
					{/if}
				</div>
			{/if}
		</div>
	{/if}
	{#if hasBody && layout === 'band'}
		<div class={cn(flushBand, 'border-t border-b-0')}>
			{@render children?.()}
			{#if footer}
				<div class={flushFooter}>
					{@render footer()}
				</div>
			{/if}
		</div>
	{:else if hasHeader || hasBody}
		<div class={cn('px-4', hasBody ? 'py-3' : 'py-4')}>
			{#if hasHeader}
				{#if label || hint}
					<div class="flex w-full items-start gap-2">
						{@render fieldLabel()}
						{@render hint?.()}
					</div>
				{/if}
				{#if descriptionText || descriptionSnippet}
					<div class={flushHeaderDescription}>
						{#if descriptionText}
							{descriptionText}
						{:else}
							{@render descriptionSnippet?.()}
						{/if}
					</div>
				{/if}
			{/if}
			{#if hasBody}
				{#if children}
					<div
						class={cn(
							hasHeader && 'mt-3',
							wide
								? 'flex w-full min-w-0 flex-col gap-3'
								: layout === 'stacked'
									? 'flex max-w-xl flex-col gap-3'
									: 'flex max-w-xl flex-wrap items-center gap-3'
						)}
					>
						{@render children()}
					</div>
				{/if}
				{#if footer}
					<div class={cn('flex flex-wrap items-center gap-2', (children || hasHeader) && 'mt-3')}>
						{@render footer()}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
