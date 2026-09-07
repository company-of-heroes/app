<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, statLosses, statWins } from '@company-of-heroes/ui/variants';
	import type { PlayerH2hRecord } from './types';

	type Props = {
		record: PlayerH2hRecord | null | undefined;
		href?: string | null;
		title?: string;
		emptyLabel?: string;
		class?: string;
	};

	let {
		record,
		href = null,
		title = 'Head to head',
		emptyLabel = 'No H2H',
		class: className
	}: Props = $props();

	const hasGames = $derived((record?.played ?? 0) > 0);
	const label = $derived(
		hasGames
			? `${record!.wins}–${record!.losses} (${record!.played})`
			: emptyLabel
	);
</script>

{#if href}
	<a
		{href}
		{title}
		class={cn(
			interactive,
			'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors',
			hasGames
				? 'border-secondary-700 bg-secondary-900/80 text-secondary-200 hover:border-primary/40 hover:text-white'
				: 'border-secondary-800 text-secondary-500 hover:text-secondary-300',
			className
		)}
	>
		{#if hasGames}
			<span class={statWins}>{record!.wins}</span>
			<span class="text-secondary-600">–</span>
			<span class={statLosses}>{record!.losses}</span>
			<span class="text-secondary-500">({record!.played})</span>
		{:else}
			{emptyLabel}
		{/if}
	</a>
{:else}
	<span
		{title}
		class={cn(
			'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
			hasGames
				? 'border-secondary-700 bg-secondary-900/80 text-secondary-200'
				: 'border-secondary-800 text-secondary-500',
			className
		)}
	>
		{label}
	</span>
{/if}
