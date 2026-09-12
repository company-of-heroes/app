<script lang="ts">
	import { tooltip } from '../attachments';
	import { getEloColor, getEloTextShadow } from '../format/player-format';
	import type { CommunityMatch, CommunityMatchDetail } from './types';
	import { getMatchAverageElo, isProGameplayMatch } from './utils';
	import CrownIcon from 'phosphor-svelte/lib/Crown';

	type Props = {
		match: CommunityMatch | CommunityMatchDetail;
		label?: string;
		tooltipLabel?: (elo: number) => string;
	};

	let {
		match,
		label = 'Pro',
		tooltipLabel = (elo) => `Pro gameplay · avg ${elo} ELO`
	}: Props = $props();

	const average = $derived(getMatchAverageElo(match));
	const isPro = $derived(isProGameplayMatch(match));
	const displayElo = $derived(average != null ? Math.max(average, 1950) : undefined);
	const color = $derived(displayElo != null ? getEloColor(displayElo) : undefined);
	const glow = $derived(getEloTextShadow(displayElo));
	const rounded = $derived(average != null ? Math.round(average) : 0);
</script>

{#if isPro && average != null}
	<span
		class="inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase"
		style:color
		style:border-color={color}
		style:background-color="color-mix(in oklch, {color} 12%, transparent)"
		style:text-shadow={glow}
		{@attach tooltip(tooltipLabel(rounded))}
	>
		<CrownIcon class="size-3 shrink-0" weight="duotone" />
		{label}
	</span>
{/if}
