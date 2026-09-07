<script lang="ts">
	import { page } from '$app/state';
	import { resource } from 'runed';
	import {
		Detail as LiveLobbyDetail,
		formatMatchupGap,
		isAlliesRace,
		isOccupiedLiveLobbyPlayer,
		teamPlayers
	} from '@company-of-heroes/ui/live-lobby';
	import type { ReplayData, ReplayPlayer } from '@company-of-heroes/ui/replay';
	import { PlayerH2hBadge } from '@company-of-heroes/ui/player-compare';
	import type { PlayerH2hRecord } from '@company-of-heroes/ui/player-compare';
	import { meSteamIds } from '$lib/auth/user';
	import { SITE_URL } from '$lib/site/urls';
	import type { ParsedReplay, ParsedReplayPlayer } from '$lib/replays';
	import {
		liveLobbyPlayerHref,
		liveLobbyPlayerLabel,
		toLiveLobby
	} from '$lib/utils/live-lobby';
	import { playerH2hBatch, searchPlayers } from '$lib/remote/players.remote';
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

	const meInLobby = $derived(
		lobby.players.find(
			(player) =>
				isOccupiedLiveLobbyPlayer(player) &&
				player.steamId &&
				mySteamIds.includes(player.steamId)
		) ?? null
	);

	const resolvedMeProfileId = resource(
		() => (meInLobby?.profileId ? null : (mySteamIds[0] ?? null)),
		async (steamId) => {
			if (!steamId) {
				return null;
			}

			const results = await searchPlayers({ q: steamId });
			return results[0]?.profileId ?? null;
		}
	);

	const meProfileId = $derived(meInLobby?.profileId ?? resolvedMeProfileId.current ?? null);

	const opponentProfileIds = $derived.by(() => {
		const me = meInLobby;
		if (!me || meProfileId == null) {
			return [] as number[];
		}

		const meAllies = isAlliesRace(me.race);
		return lobby.players
			.filter(isOccupiedLiveLobbyPlayer)
			.filter((player) => isAlliesRace(player.race) !== meAllies)
			.map((player) => player.profileId)
			.filter((id): id is number => id != null && id > 0 && id !== meProfileId);
	});

	const h2hRecords = resource(
		() => {
			if (meProfileId == null || opponentProfileIds.length === 0) {
				return null;
			}

			return `${meProfileId}:${opponentProfileIds.join(',')}`;
		},
		async (key) => {
			if (!key || meProfileId == null || opponentProfileIds.length === 0) {
				return {} as Record<string, PlayerH2hRecord>;
			}

			const result = await playerH2hBatch({ a: meProfileId, vs: opponentProfileIds });
			return result.records;
		}
	);

	function doctrineBannerForPlayer(player: ReplayPlayer) {
		return doctrineBannerUrl(player as ParsedReplayPlayer);
	}

	function playerCpmForReplay(data: ReplayData, playerId: number | null) {
		return playerCpm(data as ParsedReplay, playerId ?? undefined);
	}

	function isOpponent(profileId: number | null): boolean {
		if (profileId == null || !meInLobby) {
			return false;
		}

		return opponentProfileIds.includes(profileId);
	}
</script>

<svelte:head>
	<title>{mapName} | {t('Live lobby')}</title>
	<meta name="description" content={t('Matches that companion users are in right now.')} />
	<meta property="og:url" content="{SITE_URL}{href(`/live/${lobby.id}`)}" />
	<meta property="og:title" content="{mapName} — {t('Live lobby')}" />
</svelte:head>

{#snippet nameExtra(args: { name: string; steamId: string | null; profileId: number | null })}
	{#if meProfileId && args.profileId && args.profileId !== meProfileId && isOpponent(args.profileId)}
		<PlayerH2hBadge
			record={h2hRecords.current?.[String(args.profileId)] ?? null}
			href={href(`/compare?a=${meProfileId}&b=${args.profileId}`)}
			title={t('Head to head')}
			emptyLabel={t('No H2H')}
		/>
	{/if}
{/snippet}

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
	{nameExtra}
/>
