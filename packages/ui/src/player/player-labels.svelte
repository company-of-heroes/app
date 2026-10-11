<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { escapeHtml, tooltip } from '../attachments/tooltip.svelte';
	import { labelHex, sortPlayerLabels } from '../format/labels';
	import type { PlayerLabel } from '../format/types';
	import { Badge } from '../ui/badge';

	type Props = {
		labels?: PlayerLabel[] | null;
		class?: string;
	};

	let { labels, class: className }: Props = $props();
	const ordered = $derived(sortPlayerLabels(labels ?? []));
</script>

{#if ordered.length > 0}
	<span class={cn('inline-flex min-w-0 flex-wrap items-center gap-1', className)}>
		{#each ordered as label (label.id)}
			<Badge
				hex={labelHex(label.color)}
				{@attach tooltip(label.tooltip?.trim() ? escapeHtml(label.tooltip.trim()) : null)}
			>
				{label.name}
			</Badge>
		{/each}
	</span>
{/if}
