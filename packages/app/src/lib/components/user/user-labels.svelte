<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { escapeHtml, tooltip } from '@company-of-heroes/ui/tooltip';
	import { cn } from '$lib/utils';
	import { labelHex, sortUserLabels } from '$core/pocketbase/user-labels';
	import type { UserLabelsResponse } from '$core/pocketbase/types';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {
		labels: UserLabelsResponse[];
	} & HTMLAttributes<HTMLSpanElement>;

	let { labels, class: className, ...restProps }: Props = $props();
	const ordered = $derived(sortUserLabels(labels));
</script>

{#if ordered.length > 0}
	<span {...restProps} class={cn('inline-flex min-w-0 flex-wrap items-center gap-1', className)}>
		{#each ordered as label (label.id)}
			<Badge
				hex={labelHex(label.color)}
				{@attach tooltip(label.tooltip?.trim() ? escapeHtml(label.tooltip.trim()) : null)}
				>{label.name}</Badge
			>
		{/each}
	</span>
{/if}
