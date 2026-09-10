<script lang="ts">
	import type { PlayerEloHistoryPoint } from '$core/pocketbase/player-ratings';
	import { EloHistory } from '@company-of-heroes/ui/player-performance';
	import { MATCH_TYPES } from '$core/game/lobby';
	import { getRaceLabel } from '$lib/components/leaderboard/leaderboard-utils';
	import { getFactionFlagFromRace } from '$lib/utils';
	import dayjs from '$lib/dayjs';
	import { useI18n } from '$lib/i18n';

	type Props = {
		points: PlayerEloHistoryPoint[];
		loading?: boolean;
	};

	let { points, loading = false }: Props = $props();
	const { t } = useI18n();

	function modeLabel(matchtypeId: number) {
		return (
			MATCH_TYPES[matchtypeId as keyof typeof MATCH_TYPES] ?? t('Mode {id}', { id: matchtypeId })
		);
	}
</script>

<EloHistory
	{points}
	{loading}
	getModeLabel={modeLabel}
	getRaceLabel={getRaceLabel}
	resolveFactionFlag={getFactionFlagFromRace}
	formatAxisDate={(date) => dayjs(date).format('DD MMM')}
	formatTooltipDate={(date) => dayjs(date).format('DD MMM YYYY')}
	formatTooltipRating={(rating) => t('{rating} ELO', { rating })}
	loadingMessage={t('Loading ELO history…')}
	emptyMessage={t(
		'No tracked match ratings yet. Play with the companion running so lobby results can build this history.'
	)}
	emptyModeMessage={t('No faction ratings for this mode yet.')}
	factionNavLabel={t('Select faction')}
/>
