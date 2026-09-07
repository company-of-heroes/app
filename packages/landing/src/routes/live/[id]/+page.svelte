<script lang="ts">
	import { page } from '$app/state';
	import {
		Detail as LiveLobbyDetail,
		formatMatchupGap,
		teamPlayers
	} from '@company-of-heroes/ui/live-lobby';
	import { meSteamIds } from '$lib/auth/user';
	import { SITE_URL } from '$lib/site/urls';
	import {
		liveLobbyPlayerHref,
		liveLobbyPlayerLabel,
		toLiveLobby
	} from '$lib/utils/live-lobby';
	import { currentLocale, href, useI18n } from '$lib/i18n';
	import { formatRelativeIso, normalizeMapName } from '$lib/utils/player/format';
	import { resolveFactionFlag, resolveFallbackSrc, resolveMapSrc } from '$lib/utils/resolvers';
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
	playerLabel={(player) => liveLobbyPlayerLabel(player, t)}
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
	eloLabel={t('ELO')}
	levelLabel={t('Level')}
	posLabel={t('Pos')}
	winsLabel={t('W')}
	lossesLabel={t('L')}
	streakLabel={t('Streak')}
	unknownHostLabel={t('Unknown')}
	rankedLabel={t('Ranked')}
	customLabel={t('Custom')}
	liveLabel={t('Live')}
	{teamsValue}
/>
