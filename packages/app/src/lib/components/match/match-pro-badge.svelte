<script lang="ts">
	import { useMatch } from '.';
	import { tooltip } from '$lib/attachments';
	import { getEloColor } from '$lib/components/leaderboard/leaderboard-utils';
	import { getMatchAverageElo, isProGameplayMatch } from '$lib/utils/match-elo';
	import { Badge } from '$lib/components/ui/badge';
	import CrownIcon from 'phosphor-svelte/lib/CrownIcon';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const match = useMatch();
	const average = $derived(getMatchAverageElo(match));
	const isPro = $derived(isProGameplayMatch(match));
	const displayElo = $derived(average != null ? Math.max(average, 1950) : undefined);
	const color = $derived(displayElo != null ? getEloColor(displayElo) : undefined);
	const rounded = $derived(average != null ? Math.round(average) : 0);
</script>

{#if isPro && average != null}
	<Badge
		variant="default"
		class="shrink-0"
		{@attach tooltip(t('Pro gameplay · avg {elo} ELO', { elo: rounded }))}
	>
		<CrownIcon class="size-3 shrink-0" weight="duotone" style="color: {color}" />
		{t('Pro')}
	</Badge>
{/if}
