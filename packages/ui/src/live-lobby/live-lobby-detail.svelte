<script lang="ts">
	import type { Snippet } from 'svelte';
	import MapImage from '../ui/map-image.svelte';
	import * as List from '../ui/list';
	import { LiveBadge } from '../ui/badge';
	import { detailMetaGrid } from '@company-of-heroes/ui/variants';
	import { getEloColor, getEloTextShadow } from '@company-of-heroes/ui/format/player-format';
	import Overview from '../replay/replay-overview.svelte';
	import type {
		CommunityMatchDetail,
		CommunityPlayer,
		ReplayData,
		ReplayPlayer
	} from '../replay/types';
	import { formatMatchupGap, getLiveLobbyMatchup, hasLiveLobbyStats } from './stats';
	import {
		defaultLiveLobbyPlayerLabel,
		isOccupiedLiveLobbyPlayer,
		type LiveLobby,
		type LiveLobbyPlayer
	} from './types';

	type NameExtraArgs = {
		name: string;
		steamId: string | null;
		profileId: number | null;
	};

	type Props = {
		lobby: LiveLobby;
		meSteamIds?: string[];
		resolveMapSrc: (map: string | undefined) => string | undefined;
		resolveFallbackSrc?: () => string | undefined;
		resolveFactionFlag: (race: number) => string;
		formatMapName: (map: string) => string;
		formatStarted: (createdAt: string) => string;
		playerHref: (player: LiveLobbyPlayer) => string | null;
		communityPlayerHref: (player: CommunityPlayer) => string | null;
		playerLabel?: (player: LiveLobbyPlayer) => string;
		flagImageUrl: (country: string | null | undefined) => string | null;
		getCountryDisplayName: (country: string | null | undefined) => string | null;
		raceFromReplayFaction: (faction: string) => number;
		doctrineBannerUrl: (player: ReplayPlayer) => string | null;
		playerCpm: (replay: ReplayData, playerId: number | null) => string | number;
		getRankImage?: (race: number, rankLevel: number) => string;
		formatGap?: (gap: number | null) => string;
		nameExtra?: Snippet<[NameExtraArgs]>;
		sessionLabel?: string;
		matchTypeLabel?: string;
		gameModeLabel?: string;
		playersLabel?: string;
		startedLabel?: string;
		hostLabel?: string;
		teamsLabel?: string;
		alliesLabel?: string;
		axisLabel?: string;
		alliesEloLabel?: string;
		axisEloLabel?: string;
		gapLabel?: string;
		highestLabel?: string;
		levelLabel?: string;
		ratingLabel?: string;
		cpmLabel?: string;
		unknownDoctrineLabel?: string;
		unknownHostLabel?: string;
		rankedLabel?: string;
		customLabel?: string;
		liveLabel?: string;
		teamsValue: string;
	};

	let {
		lobby,
		meSteamIds = [],
		resolveMapSrc,
		resolveFallbackSrc,
		resolveFactionFlag,
		formatMapName,
		formatStarted,
		playerHref,
		communityPlayerHref,
		playerLabel = defaultLiveLobbyPlayerLabel,
		flagImageUrl,
		getCountryDisplayName,
		raceFromReplayFaction,
		doctrineBannerUrl,
		playerCpm,
		getRankImage,
		formatGap = (gap) => formatMatchupGap(gap),
		nameExtra,
		sessionLabel = 'Session',
		matchTypeLabel = 'Match type',
		gameModeLabel = 'Game mode',
		playersLabel = 'Players',
		startedLabel = 'Started',
		hostLabel = 'Host',
		teamsLabel = 'Teams',
		alliesLabel = 'Allies',
		axisLabel = 'Axis',
		alliesEloLabel = 'Allies ELO',
		axisEloLabel = 'Axis ELO',
		gapLabel = 'Gap',
		highestLabel = 'Highest',
		levelLabel = 'Lv',
		ratingLabel = 'Rating',
		cpmLabel = 'CPM',
		unknownDoctrineLabel = 'Unknown doctrine',
		unknownHostLabel = 'Unknown',
		rankedLabel = 'Ranked',
		customLabel = 'Custom',
		liveLabel = 'Live',
		teamsValue
	}: Props = $props();

	const mapName = $derived(formatMapName(lobby.map));
	const occupied = $derived(lobby.players.length);
	const showStats = $derived(hasLiveLobbyStats(lobby.players));
	const matchup = $derived(getLiveLobbyMatchup(lobby.players));

	const overviewMatch = $derived.by((): CommunityMatchDetail => {
		const players: CommunityPlayer[] = lobby.players
			.filter(isOccupiedLiveLobbyPlayer)
			.map((player) => ({
				playerId: player.playerId,
				steamId: player.steamId,
				race: player.race,
				likeCount: player.likeCount,
				profile: {
					profile_id: player.profileId ?? 0,
					alias: player.alias
				}
			}));

		return {
			id: lobby.id,
			map: lobby.map,
			isRanked: lobby.isRanked,
			createdAt: lobby.createdAt,
			durationSeconds: null,
			likeCount: 0,
			downloadCount: 0,
			players,
			result: null
		};
	});

	function isHighlightedName(name: string): boolean {
		if (meSteamIds.length === 0) {
			return false;
		}

		const key = name.trim().toLowerCase();
		return lobby.players.some((player) => {
			if (!player.steamId || !meSteamIds.includes(player.steamId)) {
				return false;
			}

			return playerLabel(player).trim().toLowerCase() === key;
		});
	}
</script>

{#snippet eloValue(value: number | null, alias?: string | null)}
	{#if value == null}
		<span class="text-secondary-400">—</span>
	{:else}
		<span
			class="tabular-nums"
			style:color={getEloColor(value)}
			style:text-shadow={getEloTextShadow(value)}
			title={alias ?? undefined}
		>
			{value}{#if alias}<span class="text-secondary-400 font-normal"> · {alias}</span>{/if}
		</span>
	{/if}
{/snippet}

<div class="border-secondary-800 overflow-clip border-b">
	<div
		class="border-secondary-800 grid grid-cols-1 border-b sm:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]"
	>
		<div class="border-secondary-800 aspect-square self-start sm:border-r">
			<MapImage map={lobby.map} alt={mapName} flush {resolveMapSrc} {resolveFallbackSrc} />
		</div>
		<div class="min-w-0 px-6 py-4">
			<div class="mb-3 flex min-w-0 items-center gap-3">
				<span class="font-heading min-w-0 truncate text-3xl font-bold text-white">{mapName}</span>
				<LiveBadge label={liveLabel} />
			</div>
			<div class={detailMetaGrid}>
				<List.Title>{sessionLabel}</List.Title>
				<List.Value class="tabular-nums">{lobby.sessionId}</List.Value>
				<List.Title>{matchTypeLabel}</List.Title>
				<List.Value>{lobby.isRanked ? rankedLabel : customLabel}</List.Value>
				<List.Title>{gameModeLabel}</List.Title>
				<List.Value>{lobby.modeLabel}</List.Value>
				<List.Title>{playersLabel}</List.Title>
				<List.Value>{occupied}</List.Value>
				<List.Title>{startedLabel}</List.Title>
				<List.Value class="tabular-nums">{formatStarted(lobby.createdAt)}</List.Value>
				<List.Title>{hostLabel}</List.Title>
				<List.Value>{lobby.hostName || unknownHostLabel}</List.Value>
				<List.Title>{teamsLabel}</List.Title>
				<List.Value>{teamsValue}</List.Value>
				{#if showStats}
					<List.Title>{alliesEloLabel}</List.Title>
					<List.Value>{@render eloValue(matchup.alliesAvg)}</List.Value>
					<List.Title>{axisEloLabel}</List.Title>
					<List.Value>{@render eloValue(matchup.axisAvg)}</List.Value>
					<List.Title>{gapLabel}</List.Title>
					<List.Value class="tabular-nums">{formatGap(matchup.gap)}</List.Value>
					<List.Title>{highestLabel}</List.Title>
					<List.Value class="min-w-0 truncate">
						{@render eloValue(matchup.highest, matchup.highestAlias)}
					</List.Value>
				{/if}
			</div>
		</div>
	</div>
	<div class="border-secondary-800 border-b">
		<Overview
			match={overviewMatch}
			livePlayers={lobby.players}
			playerHref={communityPlayerHref}
			livePlayerHref={playerHref}
			livePlayerLabel={playerLabel}
			{flagImageUrl}
			{getCountryDisplayName}
			{resolveFactionFlag}
			{raceFromReplayFaction}
			{doctrineBannerUrl}
			{playerCpm}
			{getRankImage}
			{levelLabel}
			{alliesLabel}
			{axisLabel}
			{unknownDoctrineLabel}
			{ratingLabel}
			{cpmLabel}
			{isHighlightedName}
			{nameExtra}
		/>
	</div>
</div>
