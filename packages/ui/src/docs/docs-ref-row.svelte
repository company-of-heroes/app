<script lang="ts">
	import type { DocRef } from '@company-of-heroes/game-data/types';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useI18n } from '@company-of-heroes/i18n';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import DocsIcon from './docs-icon.svelte';
	import { popoverEntry, useDocsPopover } from './docs-popover.context';
	import { docsPath } from './format';

	type Props = {
		ref: DocRef;
		/** Small grey line under the name (e.g. "Upgrade"). */
		note?: string;
		/** One value on the right, bold, with an optional grey label under it. */
		value?: string;
		valueLabel?: string;
		/** Smaller row for secondary lists (a building's upgrades). */
		compact?: boolean;
		/** Warm accent hover for rows on a tinted block (upgrades). */
		accent?: boolean;
	};

	let { ref, note, value, valueLabel, compact = false, accent = false }: Props = $props();
	const host = useHost();
	const { t } = useI18n();
	const popover = useDocsPopover();

	const path = $derived(docsPath(ref));
	const entry = $derived(popoverEntry(ref));
	// Link rows open the popover on hover and follow the link on click; rows without a page pin
	// it on click, the only way to see it on touch.
	const trigger = $derived(
		popover && entry ? (path ? popover.hoverTrigger(entry) : popover.trigger(entry)) : {}
	);
	const row = $derived(
		cn('flex w-full min-w-0 items-center gap-3 px-4 text-left', compact ? 'py-1.5' : 'py-2')
	);
</script>

<!-- The row of the unit lists on /stats; hovering shows the same popover. -->
{#if path}
	<a
		href={host.href(path)}
		class={cn(
			interactive,
			row,
			accent ? 'hover:bg-primary/10' : 'hover:bg-secondary-950/60',
			'transition-colors'
		)}
		{...trigger}
	>
		{@render content()}
	</a>
{:else if popover && entry}
	<button
		type="button"
		class={cn(
			interactive,
			row,
			accent ? 'hover:bg-primary/10' : 'hover:bg-secondary-950/60',
			'transition-colors'
		)}
		{...trigger}
	>
		{@render content()}
	</button>
{:else}
	<div class={row}>
		{@render content()}
	</div>
{/if}

{#snippet content()}
	<DocsIcon icon={ref.icon} name={ref.name} class={compact ? 'size-7' : 'size-8'} />
	<div class="min-w-0 flex-1">
		<p
			class={cn(
				'flex min-w-0 items-center gap-2 text-sm',
				compact && !accent ? 'text-secondary-200' : 'text-white'
			)}
		>
			<span class="truncate">{ref.name}</span>
			{#if ref.reward}
				<Badge variant="warning" class="shrink-0">{t('Medal reward')}</Badge>
			{/if}
		</p>
		{#if note}
			<p class="text-secondary-500 text-xs">{note}</p>
		{/if}
	</div>
	{#if value}
		<div class="shrink-0 text-right text-xs tabular-nums">
			<p class="text-sm font-bold text-white">{value}</p>
			{#if valueLabel}
				<p class="text-secondary-500">{valueLabel}</p>
			{/if}
		</div>
	{/if}
{/snippet}
