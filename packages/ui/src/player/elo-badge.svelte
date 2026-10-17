<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { getEloColor, getEloTextShadow, isEliteElo } from '../format/player-format';
	import { tooltip } from '../attachments';

	type Props = {
		/** Nothing renders without an ELO. */
		elo: number | null | undefined;
		/** Hover text, e.g. where the ELO comes from. */
		label?: string;
		class?: string;
	};

	let { elo, label, class: className }: Props = $props();
</script>

{#if elo != null}
	<span
		class={cn(
			'border-secondary-800 bg-secondary-950/70 inline-flex h-5 shrink-0 items-center gap-1 rounded border px-1.5 text-xs tabular-nums',
			isEliteElo(elo) ? 'font-bold tracking-wide' : 'font-semibold',
			className
		)}
		style:color={getEloColor(elo)}
		style:text-shadow={getEloTextShadow(elo)}
		{@attach label ? tooltip(label) : undefined}
	>
		{elo}
	</span>
{/if}
