<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { labelHex, sortPlayerLabels } from '../format/labels';
	import type { PlayerLabel } from '../format/types';

	type Props = {
		labels?: PlayerLabel[] | null;
		/** `sm` fits inline next to a name in dense rows (comments). */
		size?: 'md' | 'sm';
		class?: string;
	};

	let { labels, size = 'md', class: className }: Props = $props();
	const ordered = $derived(sortPlayerLabels(labels ?? []));
</script>

{#if ordered.length > 0}
	<span class={cn('inline-flex min-w-0 flex-wrap items-center gap-1', className)}>
		{#each ordered as label (label.id)}
			{@const hex = labelHex(label.color)}
			<span
				class={cn(
					'inline-block w-fit rounded-md border font-medium',
					size === 'sm' ? 'px-1.5 text-[11px] leading-4' : 'px-2.5 py-0.5 text-xs'
				)}
				style:color={hex}
				style:border-color={`color-mix(in srgb, ${hex} 25%, transparent)`}
				style:background-color={`color-mix(in srgb, ${hex} 10%, transparent)`}
			>
				{label.name}
			</span>
		{/each}
	</span>
{/if}
