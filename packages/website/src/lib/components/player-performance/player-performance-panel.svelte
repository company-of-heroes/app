<script lang="ts">
	import { PlayerPerformancePanel } from '@company-of-heroes/ui/player-performance';
	import type { PlayerPageData } from '$lib/player';
	import { normalizeMapName } from '$lib/utils/player/format';
	import { resolveFactionFlag, resolveMapSrc } from '$lib/utils/resolvers';
	import { useI18n } from '$lib/i18n';

	type Props = {
		player: PlayerPageData;
	};

	let { player }: Props = $props();
	const { t } = useI18n();
</script>

<PlayerPerformancePanel
	performance={player.performance}
	elo={player.elo}
	resolveFactionFlag={resolveFactionFlag}
	resolveMapSrc={resolveMapSrc}
	formatMapName={normalizeMapName}
	emptyPerformanceMessage={t('No tracked community matches for this player.')}
	emptyEloMessage={t(
		'No tracked match ratings yet. Play with the companion running so lobby results can build this history.'
	)}
	eloHistoryTitle={t('ELO history')}
	trackedLobbyRatingsLabel={t('Tracked lobby ratings')}
	byMapTitle={t('By map')}
	byFactionTitle={t('By faction')}
	byModeTitle={t('By mode')}
	mapsSummary={t('{maps} maps · {games} games')}
	factionsSummary={t('{factions} factions · {games} games')}
	modesSummary={t('{modes} game modes · {games} games')}
	mapLabel={t('Map')}
	gamesLabel={t('Games')}
	winsLabel={t('Wins')}
	lossesLabel={t('Losses')}
	winrateLabel={t('Winrate')}
	modeLabel={t('Mode')}
	factionLabel={t('Faction')}
	eloLabel={t('ELO')}
/>
