<script lang="ts">
	import { PlayerStatsTable } from '@company-of-heroes/ui/player';
	import type { PlayerPageData } from '$lib/player';
	import {
		getFactionFlagByLeaderboardId,
		getRankImageByLeaderboardId
	} from '$lib/utils/media/ranks';
	import { useI18n } from '$lib/i18n';

	type Props = {
		player: PlayerPageData;
	};

	let { player }: Props = $props();
	const { t } = useI18n();
</script>

<PlayerStatsTable
	{player}
	{getRankImageByLeaderboardId}
	{getFactionFlagByLeaderboardId}
	emptyMessage={t('No leaderboard stats yet.')}
	eloLabel={t('ELO')}
	levelLabelText={t('Level')}
	typeLabel={t('Type')}
	positionLabelText={t('Position')}
	winsLabel={t('Wins')}
	lossesLabel={t('Losses')}
	streakLabel={t('Streak')}
	notAvailableLabel={t('N/A')}
/>
