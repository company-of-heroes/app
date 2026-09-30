<script lang="ts">
	import { H } from '@company-of-heroes/ui/h';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import type { Snippet } from 'svelte';
	import type { Component } from 'svelte';

	type Props = {
		title: string;
		summary?: string;
		icon?: Component;
		expanded?: boolean;
		children: Snippet;
	};

	let { title, summary, icon: Icon, expanded = $bindable(false), children }: Props = $props();
</script>

<section class="border-secondary-800 border-b last:border-b-0">
	<button
		type="button"
		class={cn(
			interactive,
			'flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left transition-colors outline-none',
			'focus-visible:ring-primary/25 focus-visible:ring-2 focus-visible:ring-inset',
			expanded ? 'border-secondary-800/80' : 'border-transparent',
			'hover:bg-secondary-950/50'
		)}
		aria-expanded={expanded}
		onclick={() => (expanded = !expanded)}
	>
		<span class="flex min-w-0 items-center gap-2.5">
			{#if Icon}
				<Icon
					class={cn(
						'size-5 shrink-0 transition-colors',
						expanded ? 'text-primary' : 'text-secondary-400'
					)}
					weight="duotone"
				/>
			{/if}
			<H level={6} class={cn('mb-0 font-semibold transition-colors', expanded && 'text-primary')}>
				{title}
			</H>
		</span>
		<span class="flex shrink-0 items-center gap-2.5">
			{#if summary}
				<span class="text-secondary-400 text-sm tabular-nums">{summary}</span>
			{/if}
			<CaretDownIcon
				class={cn(
					'text-secondary-400 size-4 transition-transform',
					expanded && 'text-primary rotate-180'
				)}
			/>
		</span>
	</button>
	{#if expanded}
		<div>{@render children()}</div>
	{/if}
</section>
