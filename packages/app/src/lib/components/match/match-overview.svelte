<script lang="ts">
	import type { MatchExpanded } from '$core/app/database/matches';
	import type { LobbyPlayer, TransformedMatch } from '@fknoobs/app';
	import {
		Overview,
		type CommunityMatchDetail,
		type CommunityPlayer,
		type ReplayData
	} from '@company-of-heroes/ui/replay';
	import type { LiveLobbyPlayer } from '@company-of-heroes/ui/live-lobby';
	import * as PlayerUi from '$lib/components/player';
	import { app } from '$core/app/context';
	import { getFactionFlagFromRace, getRankImage } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType, getPlayerEloFromMatchHistory } from '$lib/utils/game';
	import { getStoredEloRating, isValidSteamId } from '$lib/utils/player-elo';
	import {
		getLiveLobbyMatchType,
		getPlayerAlias,
		getPlayerProfileId,
		isHighlightedPlayer
	} from '$lib/components/widgets/dashboard-utils';
	import { getCountryDisplayName } from '$lib/components/leaderboard/leaderboard-utils';
	import { getPlayerRatings } from '$core/pocketbase/player-ratings';
	import { preloadPlayerLabels } from '$core/pocketbase/player-label-cache.svelte';
	import {
		likeCountForSteamId,
		preloadPlayerLikeCounts
	} from '$core/pocketbase/player-vote-cache.svelte';
	import { resource } from 'runed';
	import { useI18n } from '$lib/i18n';
	import { formatStreak } from '@company-of-heroes/ui/variants';

	type Props = {
		match: MatchExpanded;
		cheaters?: Set<string>;
	};

	let { match, cheaters = new Set<string>() }: Props = $props();
	const { t } = useI18n();

	const result = $derived(match.result as TransformedMatch | null | undefined);
	const matchType = $derived(
		result?.matchtype_id ?? getLiveLobbyMatchType(match.players ?? [], match.isRanked)
	);
	const highlightPlayerId = $derived(app.game.profile?.relic.profile_id);
	const ratingsKey = $derived(
		(match.players ?? [])
			.map((player) => player.steamId)
			.filter(isValidSteamId)
			.join(',')
	);
	const ratings = resource(
		() => ratingsKey,
		(key) => getPlayerRatings(key ? key.split(',') : [])
	);

	$effect(() => {
		const ids = (match.players ?? []).map((player) => player.steamId).filter(Boolean) as string[];
		if (ids.length > 0) {
			preloadPlayerLabels(ids);
			preloadPlayerLikeCounts(ids);
		}
	});

	const playersWithElo = $derived.by((): LobbyPlayer[] => {
		const source = match.players ?? [];
		const stored = ratings.current;
		if (!stored) return source;

		return source.map((player) => {
			if (!player.steamId) return player;
			const record = stored.get(player.steamId);
			return record ? { ...player, storedElo: record.elo } : player;
		});
	});

	const overviewMatch = $derived.by((): CommunityMatchDetail => {
		const players: CommunityPlayer[] = playersWithElo.map((player) => {
			const profileId = getPlayerProfileId(player) ?? 0;
			const likeCount = likeCountForSteamId(player.steamId);
			return {
				playerId: player.playerId ?? null,
				steamId: player.steamId ?? null,
				race: player.race ?? null,
				likeCount: likeCount ?? undefined,
				profile: {
					profile_id: profileId,
					alias: getPlayerAlias(player)
				}
			};
		});

		return {
			id: match.id,
			map: match.map ?? '',
			isRanked: !!match.isRanked,
			createdAt: match.createdAt ?? '',
			durationSeconds: null,
			likeCount: match.likeCount ?? 0,
			downloadCount: match.downloadCount ?? 0,
			players,
			result: result ?? null
		};
	});

	const livePlayers = $derived.by((): LiveLobbyPlayer[] => {
		return playersWithElo.map((player, index) => {
			const profileId = getPlayerProfileId(player) ?? null;
			const isCpu = player.playerId === -1;
			const statsRow = isCpu
				? null
				: getLeaderboardStatsForPlayerByMatchType(matchType, player);
			const elo = isCpu
				? null
				: (getPlayerEloFromMatchHistory(matchType, player) ??
					getStoredEloRating(player.storedElo, matchType, player.race) ??
					null);
			const country = isCpu ? null : player.profile?.country || null;

			return {
				index: player.index ?? index,
				playerId: player.playerId,
				type: player.type,
				race: player.race,
				team: player.team,
				alias: getPlayerAlias(player),
				profileId: !isCpu && profileId != null && profileId > 0 ? profileId : null,
				steamId: isCpu ? null : (player.steamId ?? null),
				country,
				likeCount: isCpu ? undefined : (likeCountForSteamId(player.steamId) ?? undefined),
				stats:
					!isCpu && (statsRow || elo != null)
						? {
								elo,
								wins: statsRow?.wins ?? 0,
								losses: statsRow?.losses ?? 0,
								streak: statsRow?.streak ?? 0,
								rank: statsRow?.rank ?? 0,
								rankLevel: statsRow?.ranklevel ?? 0
							}
						: null
			};
		});
	});

	function resolveFactionFlag(raceId: number): string {
		return getFactionFlagFromRace(raceId);
	}

	function flagImageUrl(country: string | null | undefined): string | null {
		if (!country) return null;
		const region = String(country).trim().toUpperCase();
		if (!/^[A-Z]{2}$/.test(region)) return null;
		return `https://flagsapi.com/${region}/shiny/64.png`;
	}

	function playerHref(player: CommunityPlayer): string | null {
		if (player.playerId === -1) {
			return null;
		}

		const id = player.profile.profile_id;
		return id > 0 ? `/players/${id}` : null;
	}

	function livePlayerHref(player: LiveLobbyPlayer): string | null {
		if (player.playerId === -1) {
			return null;
		}

		return player.profileId != null && player.profileId > 0
			? `/players/${player.profileId}`
			: null;
	}

	function isHighlightedName(name: string): boolean {
		const key = name.trim().toLowerCase();
		const player = playersWithElo.find(
			(entry) => getPlayerAlias(entry).trim().toLowerCase() === key
		);
		return player ? isHighlightedPlayer(player, highlightPlayerId) : false;
	}

	function raceFromReplayFaction(_faction: string): number {
		return 0;
	}

	function doctrineBannerUrl(_player: { faction: string }): string | null {
		return null;
	}

	function playerCpm(_replay: ReplayData, _playerId: number | null): string {
		return '—';
	}
</script>

{#snippet nameExtra(args: { name: string; steamId: string | null; profileId: number | null })}
	{@const lobbyPlayer = playersWithElo.find((player) => {
		if (args.profileId != null && getPlayerProfileId(player) === args.profileId) return true;
		if (args.steamId && player.steamId === args.steamId) return true;
		return getPlayerAlias(player).trim().toLowerCase() === args.name.trim().toLowerCase();
	})}
	{#if lobbyPlayer}
		<PlayerUi.Root player={lobbyPlayer} race={lobbyPlayer.race}>
			<PlayerUi.Labels steamId={lobbyPlayer.steamId} class="shrink-0" />
			{#if lobbyPlayer.steamId && cheaters.has(lobbyPlayer.steamId)}
				<PlayerUi.CheaterAlert compact />
			{/if}
		</PlayerUi.Root>
	{/if}
{/snippet}

<Overview
	match={overviewMatch}
	{livePlayers}
	{playerHref}
	{flagImageUrl}
	{getCountryDisplayName}
	{resolveFactionFlag}
	{raceFromReplayFaction}
	{doctrineBannerUrl}
	{playerCpm}
	formatStreakLabel={formatStreak}
	getRankImage={getRankImage}
	levelLabel={t('Lv')}
	alliesLabel={t('Allies')}
	axisLabel={t('Axis')}
	unknownDoctrineLabel={t('Unknown doctrine')}
	ratingLabel={t('Rating')}
	cpmLabel={t('CPM')}
	{livePlayerHref}
	{isHighlightedName}
	{nameExtra}
/>
