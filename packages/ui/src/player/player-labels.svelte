<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { escapeHtml, tooltip } from '../attachments/tooltip.svelte';
	import { labelHex, sortPlayerLabels } from '../format/labels';
	import type { PlayerLabel } from '../format/types';
	import { Badge } from '../ui/badge';

	type Props = {
		labels?: PlayerLabel[] | null;
		/** One line that gives way to its neighbours: badges that do not fit are cut off. */
		truncate?: boolean;
		class?: string;
	};

	let { labels, truncate = false, class: className }: Props = $props();
	const ordered = $derived(sortPlayerLabels(labels ?? []));
</script>

{#if ordered.length > 0}
	<span
		class={cn(
			'inline-flex min-w-0 flex-wrap items-center gap-1',
			// One badge-high line: badges that do not fit wrap out of sight, a lone wide one ends in "…".
			truncate && 'h-5.5 overflow-hidden',
			className
		)}
	>
		{#each ordered as label (label.id)}
			<Badge
				hex={labelHex(label.color)}
				class={cn(truncate && 'max-w-full min-w-0')}
				{@attach tooltip(label.tooltip?.trim() ? escapeHtml(label.tooltip.trim()) : null)}
			>
				{#if truncate}
					<span class="truncate">{label.name}</span>
				{:else}
					{label.name}
				{/if}
			</Badge>
		{/each}
	</span>
{/if}
