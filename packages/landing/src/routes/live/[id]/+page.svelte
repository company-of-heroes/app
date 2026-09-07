<script lang="ts">
	import { page } from '$app/state';
	import {
		Detail as LiveLobbyDetail,
		formatMatchupGap,
		teamPlayers
	} from '@company-of-heroes/ui/live-lobby';
	import type { ReplayData, ReplayPlayer } from '@company-of-heroes/ui/replay';
	import { meSteamIds } from '$lib/auth/user';
	import { SITE_URL } from '$lib/site/urls';
	import type { ParsedReplay, ParsedReplayPlayer } from '$lib/replays';
	import {
		liveLobbyPlayerHref,
		liveLobbyPlayerLabel,
		toLiveLobby
	} from '$lib/utils/live-lobby';
	import { currentLocale, href, useI18n } from '$lib/i18n';
	import { formatRelativeIso, normalizeMapName } from '$lib/utils/player/format';
	import {
		doctrineBannerUrl,
		flagImageUrl,
		getCountryDisplayName,
		getRankImageByRace,
		playerCpm,
		raceFromReplayFaction,
		resolveFactionFlag,
		resolveFallbackSrc,
		resolveMapSrc,
		resolvePlayerHref
	} from '$lib/utils/resolvers';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const lobby = $derived(toLiveLobby(data.lobby, t));
	const mySteamIds = $derived(meSteamIds(page.data.user));
	const mapName = $derived(normalizeMapName(lobby.map));
	const teamsValue = $derived(
		t('{allies} vs {axis}', {
			allies: teamPlayers(lobby.players, 'allies').length,
			axis: teamPlayers(lobby.players, 'axis').length
		})
	);
	const formatGap = (gap: number | null) =>
		formatMatchupGap(gap, {
			even: t('Even'),
			axisAhead: (value) => t('Axis +{gap}', { gap: value }),
			alliesAhead: (value) => t('Allies +{gap}', { gap: value })
		});

	function doctrineBannerForPlayer(player: ReplayPlayer) {
		return doctrineBannerUrl(player as ParsedReplayPlayer);
	}

	function playerCpmForReplay(data: ReplayData, playerId: number | null) {
		return playerCpm(data as ParsedReplay, playerId ?? undefined);
	}
</script>

<svelte:head>
	<title>{mapName} | {t('Live lobby')}</title>
	<meta name="description" content={t('Matches that companion users are in right now.')} />
	<meta property="og:url" content="{SITE_URL}{href(`/live/${lobby.id}`)}" />
	<meta property="og:title" content="{mapName} — {t('Live lobby')}" />
</svelte:head>

<LiveLobbyDetail
	{lobby}
	meSteamIds={mySteamIds}
	{resolveMapSrc}
	{resolveFallbackSrc}
	{resolveFactionFlag}
	playerHref={liveLobbyPlayerHref}
	communityPlayerHref={resolvePlayerHref}
	playerLabel={(player) => liveLobbyPlayerLabel(player, t)}
	{flagImageUrl}
	{getCountryDisplayName}
	{raceFromReplayFaction}
	doctrineBannerUrl={doctrineBannerForPlayer}
	playerCpm={playerCpmForReplay}
	getRankImage={getRankImageByRace}
	formatMapName={normalizeMapName}
	formatStarted={(createdAt) => formatRelativeIso(createdAt, currentLocale())}
	{formatGap}
	sessionLabel={t('Session')}
	matchTypeLabel={t('Match type')}
	gameModeLabel={t('Game mode')}
	playersLabel={t('Players')}
	startedLabel={t('Started')}
	hostLabel={t('Host')}
	teamsLabel={t('Teams')}
	alliesLabel={t('Allies')}
	axisLabel={t('Axis')}
	alliesEloLabel={t('Allies ELO')}
	axisEloLabel={t('Axis ELO')}
	gapLabel={t('Gap')}
	highestLabel={t('Highest')}
	levelLabel={t('Lv')}
	ratingLabel={t('Rating')}
	cpmLabel={t('CPM')}
	unknownDoctrineLabel={t('Unknown doctrine')}
	unknownHostLabel={t('Unknown')}
	rankedLabel={t('Ranked')}
	customLabel={t('Custom')}
	liveLabel={t('Live')}
	{teamsValue}
/>
