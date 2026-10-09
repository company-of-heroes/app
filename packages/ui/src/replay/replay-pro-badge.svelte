<script lang="ts">
	import { tooltip } from '../attachments';
	import { getEloColor } from '../format/player-format';
	import type { CommunityMatch, CommunityMatchDetail } from './types';
	import { getMatchAverageElo, isProGameplayMatch } from './utils';
	import { Badge } from '../ui/badge';
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
	const rounded = $derived(average != null ? Math.round(average) : 0);
</script>

{#if isPro && average != null}
	<Badge variant="default" class="shrink-0" {@attach tooltip(tooltipLabel(rounded))}>
		<CrownIcon class="size-3 shrink-0" weight="duotone" style="color: {color}" />
		{label}
	</Badge>
{/if}
