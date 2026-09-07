<script lang="ts">
	import MapImage from '../ui/map-image.svelte';
	import * as List from '../ui/list';
	import { LiveBadge } from '../ui/badge';
	import { detailMetaGrid } from '@company-of-heroes/ui/variants';
	import { getEloColor, getEloTextShadow } from '@company-of-heroes/ui/format/player-format';
	import LiveLobbyPlayers from './live-lobby-players.svelte';
	import { formatMatchupGap, getLiveLobbyMatchup, hasLiveLobbyStats } from './stats';
	import { defaultLiveLobbyPlayerLabel, type LiveLobby, type LiveLobbyPlayer } from './types';

	type Props = {
		lobby: LiveLobby;
		meSteamIds?: string[];
		resolveMapSrc: (map: string | undefined) => string | undefined;
		resolveFallbackSrc?: () => string | undefined;
		resolveFactionFlag: (race: number) => string;
		formatMapName: (map: string) => string;
		formatStarted: (createdAt: string) => string;
		playerHref: (player: LiveLobbyPlayer) => string | null;
		playerLabel?: (player: LiveLobbyPlayer) => string;
		formatGap?: (gap: number | null) => string;
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
		eloLabel?: string;
		levelLabel?: string;
		posLabel?: string;
		winsLabel?: string;
		lossesLabel?: string;
		streakLabel?: string;
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
		playerLabel = defaultLiveLobbyPlayerLabel,
		formatGap = (gap) => formatMatchupGap(gap),
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
		eloLabel = 'ELO',
		levelLabel = 'Level',
		posLabel = 'Pos',
		winsLabel = 'W',
		lossesLabel = 'L',
		streakLabel = 'Streak',
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
		<LiveLobbyPlayers
			players={lobby.players}
			{meSteamIds}
			{resolveFactionFlag}
			{playerHref}
			{playerLabel}
			{showStats}
			{alliesLabel}
			{axisLabel}
			{eloLabel}
			{levelLabel}
			{posLabel}
			{winsLabel}
			{lossesLabel}
			{streakLabel}
		/>
	</div>
</div>
