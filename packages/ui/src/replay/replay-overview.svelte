<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		formatStreak,
		interactive,
		mePlayerText,
		statLosses,
		statWins
	} from '@company-of-heroes/ui/variants';
	import { getEloColor, getEloTextShadow, isEliteElo } from '../format/player-format';
	import type {
		CommunityMatchDetail,
		CommunityPlayer,
		MatchResultPlayer,
		ReplayData,
		ReplayPlayer
	} from './types';
	import { findResultPlayer, isCpuPlayerName, isCpuReplayPlayer } from './utils';
	import {
		defaultLiveLobbyPlayerLabel,
		isCpuLiveLobbyPlayer,
		teamPlayers,
		type LiveLobbyPlayer,
		type LiveLobbyPlayerStats
	} from '../live-lobby/types';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import MinusIcon from 'phosphor-svelte/lib/MinusIcon';
	import PlayerLikeCount from '../player/player-like-count.svelte';

	type NameExtraArgs = {
		name: string;
		steamId: string | null;
		profileId: number | null;
	};

	type Props = {
		match: CommunityMatchDetail;
		replay?: ReplayData | null;
		livePlayers?: LiveLobbyPlayer[];
		playerHref: (player: CommunityPlayer) => string | null;
		flagImageUrl: (country: string | null | undefined) => string | null;
		getCountryDisplayName: (country: string | null | undefined) => string | null;
		resolveFactionFlag: (raceId: number) => string;
		raceFromReplayFaction: (faction: string) => number;
		doctrineBannerUrl: (player: ReplayPlayer) => string | null;
		playerCpm: (replay: ReplayData, playerId: number | null) => string | number;
		formatStreakLabel?: (streak: number) => string;
		livePlayerHref?: (player: LiveLobbyPlayer) => string | null;
		livePlayerLabel?: (player: LiveLobbyPlayer) => string;
		getRankImage?: (race: number, rankLevel: number) => string;
		levelLabel?: string;
		alliesLabel?: string;
		axisLabel?: string;
		unknownDoctrineLabel?: string;
		ratingLabel?: string;
		cpmLabel?: string;
		isHighlightedName?: (name: string) => boolean;
		nameExtra?: Snippet<[NameExtraArgs]>;
	};

	let {
		match,
		replay = null,
		livePlayers = [],
		playerHref,
		flagImageUrl,
		getCountryDisplayName,
		resolveFactionFlag,
		raceFromReplayFaction,
		doctrineBannerUrl,
		playerCpm,
		formatStreakLabel = formatStreak,
		livePlayerHref,
		livePlayerLabel = defaultLiveLobbyPlayerLabel,
		getRankImage,
		levelLabel = 'Lv',
		alliesLabel = 'Allies',
		axisLabel = 'Axis',
		unknownDoctrineLabel = 'Unknown doctrine',
		ratingLabel = 'Rating',
		cpmLabel = 'CPM',
		isHighlightedName,
		nameExtra
	}: Props = $props();

	const teams = $derived.by(() => ({
		allies:
			replay?.players.filter((player) =>
				String(player.faction || '')
					.toLowerCase()
					.startsWith('allies')
			) ?? [],
		axis:
			replay?.players.filter((player) =>
				String(player.faction || '')
					.toLowerCase()
					.startsWith('axis')
			) ?? []
	}));

	const liveTeams = $derived.by(() => ({
		allies: teamPlayers(livePlayers, 'allies'),
		axis: teamPlayers(livePlayers, 'axis')
	}));

	function replayPlayerIndex(replayPlayer: ReplayPlayer): number {
		if (!replay?.players?.length) {
			return -1;
		}

		return replay.players.indexOf(replayPlayer);
	}

	function lobbyPlayer(replayPlayer: ReplayPlayer): CommunityPlayer | undefined {
		if (isCpuReplayPlayer(replayPlayer)) {
			return undefined;
		}

		const steamId = replayPlayer.steamId ? String(replayPlayer.steamId) : null;
		if (steamId) {
			const bySteam = match.players.find((player) => player.steamId === steamId);
			if (bySteam) {
				return bySteam;
			}
		}

		const name = replayPlayer.name.trim().toLowerCase();
		if (name) {
			const byName = match.players.find(
				(player) =>
					player.playerId !== -1 &&
					!isCpuPlayerName(player.profile.alias) &&
					player.profile.alias.trim().toLowerCase() === name
			);
			if (byName) {
				return byName;
			}
		}

		const index = replayPlayerIndex(replayPlayer);
		if (
			index >= 0 &&
			replay?.players?.length === match.players.length &&
			match.players[index] &&
			match.players[index].playerId !== -1 &&
			!isCpuPlayerName(match.players[index].profile.alias)
		) {
			return match.players[index];
		}

		return undefined;
	}

	function resultPlayer(replayPlayer: ReplayPlayer): MatchResultPlayer | undefined {
		if (isCpuReplayPlayer(replayPlayer)) {
			return undefined;
		}

		const name = replayPlayer.name.trim().toLowerCase();
		if (name) {
			const fromResult = match.result?.players?.find(
				(player) =>
					!isCpuPlayerName(player.alias) &&
					(player.alias ?? '').trim().toLowerCase() === name
			);
			if (fromResult) {
				return fromResult;
			}
		}

		const lobby = lobbyPlayer(replayPlayer);
		if (lobby) {
			const fromLobby = findResultPlayer(match, lobby);
			if (fromLobby) {
				return fromLobby;
			}
		}

		const index = replayPlayerIndex(replayPlayer);
		const resultPlayers = match.result?.players;
		if (
			index >= 0 &&
			resultPlayers &&
			replay?.players?.length === resultPlayers.length &&
			resultPlayers[index] &&
			!isCpuPlayerName(resultPlayers[index].alias)
		) {
			return resultPlayers[index];
		}

		return undefined;
	}

	function livePlayerForReplay(replayPlayer: ReplayPlayer): LiveLobbyPlayer | undefined {
		if (isCpuReplayPlayer(replayPlayer)) {
			return undefined;
		}

		const lobby = lobbyPlayer(replayPlayer);
		const profileId = lobby?.profile.profile_id;
		if (profileId != null && profileId > 0) {
			const byId = livePlayers.find(
				(player) => !isCpuLiveLobbyPlayer(player) && player.profileId === profileId
			);
			if (byId) {
				return byId;
			}
		}

		const steamId = lobby?.steamId ?? (replayPlayer.steamId ? String(replayPlayer.steamId) : null);
		if (steamId) {
			const bySteam = livePlayers.find(
				(player) => !isCpuLiveLobbyPlayer(player) && player.steamId === steamId
			);
			if (bySteam) {
				return bySteam;
			}
		}

		const key = replayPlayer.name.trim().toLowerCase();
		if (key) {
			const byName = livePlayers.find(
				(player) =>
					!isCpuLiveLobbyPlayer(player) && player.alias.trim().toLowerCase() === key
			);
			if (byName) {
				return byName;
			}
		}

		const index = replayPlayerIndex(replayPlayer);
		if (index >= 0 && livePlayers.length === (replay?.players?.length ?? 0)) {
			const byIndex =
				livePlayers.find((player) => player.index === index) ??
				(livePlayers[index]?.index == null ? livePlayers[index] : undefined);
			if (byIndex && !isCpuLiveLobbyPlayer(byIndex)) {
				return byIndex;
			}
		}

		return undefined;
	}

	function liveStatsForReplay(replayPlayer: ReplayPlayer): LiveLobbyPlayerStats | undefined {
		return livePlayerForReplay(replayPlayer)?.stats ?? undefined;
	}

	function ratingDelta(result: MatchResultPlayer): number | undefined {
		const next = result.newrating;
		const prev = result.oldrating;
		if (!Number.isFinite(next) || !Number.isFinite(prev)) {
			return undefined;
		}

		return (next as number) - (prev as number);
	}

	function displayElo(result: MatchResultPlayer): number | null {
		if ((result.newrating ?? 0) >= 1) {
			return result.newrating ?? null;
		}

		if ((result.oldrating ?? 0) >= 1) {
			return result.oldrating ?? null;
		}

		return null;
	}

	function likeCountForSteamId(steamId: string | null | undefined): number | null {
		if (!steamId) {
			return null;
		}

		const fromMatch = match.players.find((player) => player.steamId === steamId)?.likeCount;
		if (fromMatch != null) {
			return fromMatch;
		}

		return livePlayers.find((player) => player.steamId === steamId)?.likeCount ?? null;
	}

	function nameTextClass(name: string): string {
		return cn(
			'min-w-0 truncate text-base font-semibold tracking-tight',
			isHighlightedName?.(name) ? mePlayerText : 'text-white'
		);
	}
</script>

{#snippet position(rank?: number | null)}
	{#if getRankImage}
		<span class="text-secondary-200 inline-flex shrink-0 items-center gap-1 text-sm tabular-nums">
			<span class="text-secondary-400">#</span>
			<span class="text-secondary-100">{rank && rank > 0 ? rank : '—'}</span>
		</span>
	{/if}
{/snippet}

{#snippet rankBadge(race: number, rankLevel?: number | null)}
	{#if getRankImage}
		<span class="text-secondary-600" aria-hidden="true">·</span>
		<span class="text-secondary-200 inline-flex items-center gap-1">
			<img src={getRankImage(race, rankLevel ?? 0)} alt="" class="h-5 w-5" />
			<span class="text-secondary-400">{levelLabel}</span>
			<span class="text-secondary-100">{rankLevel && rankLevel > 0 ? rankLevel : '—'}</span>
		</span>
	{/if}
{/snippet}

{#snippet playerRow(player: ReplayPlayer)}
	{@const cpu = isCpuReplayPlayer(player)}
	{@const lobby = cpu ? undefined : lobbyPlayer(player)}
	{@const result = cpu ? undefined : resultPlayer(player)}
	{@const live = cpu ? undefined : livePlayerForReplay(player)}
	{@const href = cpu
		? null
		: ((lobby ? playerHref(lobby) : null) ??
			(live && livePlayerHref ? livePlayerHref(live) : null) ??
			(result?.profile_id
				? playerHref({
						playerId: result.profile_id,
						steamId: result.steamId ?? null,
						race: result.race_id ?? null,
						profile: {
							profile_id: result.profile_id,
							alias: result.alias ?? player.name
						}
					})
				: null) ??
			(player.steamId
				? playerHref({
						playerId: null,
						steamId: String(player.steamId),
						race: null,
						profile: { profile_id: 0, alias: player.name }
					})
				: null))}
	{@const elo = result ? displayElo(result) : null}
	{@const change = result ? ratingDelta(result) : undefined}
	{@const race = result?.race_id ?? lobby?.race ?? raceFromReplayFaction(player.faction)}
	{@const liveStats = live?.stats ?? liveStatsForReplay(player)}
	{@const banner = doctrineBannerUrl(player)}
	{@const country = result?.country ?? live?.country ?? null}
	{@const flagUrl = flagImageUrl(country)}
	{@const countryName = getCountryDisplayName(country)}
	{@const steamId = lobby?.steamId ?? live?.steamId ?? null}
	{@const profileId = lobby?.profile.profile_id ?? live?.profileId ?? null}
	<div
		class={cn(
			'border-secondary-800 relative overflow-hidden border-b last:border-b-0',
			result?.outcome === 1 && 'bg-success/5',
			result?.outcome === 0 && 'bg-destructive/5'
		)}
	>
		{#if banner}
			<img
				src={banner}
				alt=""
				aria-hidden="true"
				class="pointer-events-none absolute inset-0 h-full w-full object-cover object-left opacity-[0.16]"
			/>
			<div
				class="from-secondary-950/25 via-secondary-950/60 to-secondary-950/92 pointer-events-none absolute inset-0 bg-linear-to-r"
			></div>
		{/if}
		<div class="relative flex items-center gap-4 px-4 py-3.5">
			<div class="min-w-0 flex-1">
				<div class="flex min-w-0 items-center gap-2">
					{#if flagUrl}
						<img
							src={flagUrl}
							alt={countryName ?? country ?? ''}
							title={countryName ?? undefined}
							class="h-4 w-auto shrink-0 rounded-xs"
						/>
					{/if}
					{#if !cpu}
						<PlayerLikeCount likeCount={likeCountForSteamId(steamId)} class="shrink-0" />
					{/if}
					{#if href}
						<a {href} class={cn(interactive, nameTextClass(player.name), 'hover:text-primary')}>
							{player.name}
						</a>
					{:else}
						<span class={nameTextClass(player.name)}>{player.name}</span>
					{/if}
					{#if !cpu}
						{@render nameExtra?.({ name: player.name, steamId, profileId })}
						{@render position(liveStats?.rank)}
					{/if}
				</div>
				<div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base tabular-nums">
					<img
						src={resolveFactionFlag(race ?? 0)}
						alt=""
						class="ring-secondary-800 size-5 shrink-0 rounded-full object-cover ring-4"
					/>
					<span class="text-secondary-200 truncate">
						{player.doctrineName || unknownDoctrineLabel}
					</span>
					{#if !cpu}
						{@render rankBadge(race ?? 0, liveStats?.rankLevel)}
					{/if}
					{#if result}
						<span class="text-secondary-600" aria-hidden="true">·</span>
						<span class="inline-flex items-center gap-1">
							<span class={statWins}>{result.wins ?? 0}</span>
							<span class="text-secondary-500">/</span>
							<span class={statLosses}>{result.losses ?? 0}</span>
						</span>
						{#if result.streak}
							<span class="text-secondary-600" aria-hidden="true">·</span>
							<span
								class={result.streak > 0
									? 'text-green-300'
									: result.streak < 0
										? 'text-red-300'
										: 'text-secondary-400'}
							>
								{formatStreakLabel(result.streak)}
							</span>
						{/if}
					{/if}
				</div>
			</div>
			{#if result}
				<div class="flex shrink-0 items-center gap-2.5 tabular-nums">
					{#if change !== undefined}
						<span class="inline-flex items-center gap-0.5 text-sm">
							{#if change < 0}
								<CaretDownIcon class="text-destructive size-3.5 shrink-0" weight="duotone" />
								<span class="text-red-200">{Math.abs(change)}</span>
							{:else if change > 0}
								<CaretUpIcon class="text-success size-3.5 shrink-0" weight="duotone" />
								<span class="text-green-200">{change}</span>
							{:else}
								<MinusIcon class="text-secondary-500 size-3.5 shrink-0" />
							{/if}
						</span>
					{/if}
					<span
						class={cn('text-base font-semibold', isEliteElo(elo) && 'font-bold tracking-wide')}
						style:color={elo != null ? getEloColor(elo) : undefined}
						style:text-shadow={getEloTextShadow(elo)}
					>
						{elo ?? 'N/A'}
					</span>
				</div>
			{/if}
			<div class="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5">
				<span class="text-secondary-400 text-xs font-semibold tracking-wider uppercase">
					{cpmLabel}
				</span>
				<span class="text-primary text-xl leading-none font-bold tabular-nums">
					{replay ? playerCpm(replay, player.id) : '—'}
				</span>
			</div>
		</div>
	</div>
{/snippet}

{#snippet livePlayerRow(player: LiveLobbyPlayer)}
	{@const cpu = isCpuLiveLobbyPlayer(player)}
	{@const href = cpu ? null : (livePlayerHref?.(player) ?? null)}
	{@const label = livePlayerLabel(player)}
	{@const stats = cpu ? null : player.stats}
	{@const elo = stats?.elo ?? null}
	{@const country = cpu ? null : (player.country ?? null)}
	{@const flagUrl = flagImageUrl(country)}
	{@const countryName = getCountryDisplayName(country)}
	<div class="border-secondary-800 relative overflow-hidden border-b last:border-b-0">
		<div class="relative flex items-center gap-4 px-4 py-3.5">
			<div class="min-w-0 flex-1">
				<div class="flex min-w-0 items-center gap-2">
					{#if flagUrl}
						<img
							src={flagUrl}
							alt={countryName ?? country ?? ''}
							title={countryName ?? undefined}
							class="h-4 w-auto shrink-0 rounded-xs"
						/>
					{/if}
					{#if !cpu}
						<PlayerLikeCount likeCount={player.likeCount} class="shrink-0" />
					{/if}
					{#if href}
						<a {href} class={cn(interactive, nameTextClass(label), 'hover:text-primary')}>
							{label}
						</a>
					{:else}
						<span class={nameTextClass(label)}>{label}</span>
					{/if}
					{#if !cpu}
						{@render nameExtra?.({
							name: label,
							steamId: player.steamId,
							profileId: player.profileId
						})}
						{@render position(stats?.rank)}
					{/if}
				</div>
				<div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base tabular-nums">
					<img
						src={resolveFactionFlag(player.race)}
						alt=""
						class="ring-secondary-800 size-5 shrink-0 rounded-full object-cover ring-4"
					/>
					<span class="text-secondary-400">—</span>
					{#if !cpu}
						{@render rankBadge(player.race, stats?.rankLevel)}
					{/if}
					{#if stats}
						<span class="text-secondary-600" aria-hidden="true">·</span>
						<span class="inline-flex items-center gap-1">
							<span class={statWins}>{stats.wins}</span>
							<span class="text-secondary-500">/</span>
							<span class={statLosses}>{stats.losses}</span>
						</span>
						{#if stats.streak}
							<span class="text-secondary-600" aria-hidden="true">·</span>
							<span
								class={stats.streak > 0
									? 'text-green-300'
									: stats.streak < 0
										? 'text-red-300'
										: 'text-secondary-400'}
							>
								{formatStreakLabel(stats.streak)}
							</span>
						{/if}
					{:else}
						<span class="text-secondary-600" aria-hidden="true">·</span>
						<span class="text-secondary-400">—</span>
					{/if}
				</div>
			</div>
			<div class="flex shrink-0 items-center gap-2.5 tabular-nums">
				<span class="inline-flex items-center gap-0.5 text-sm">
					<MinusIcon class="text-secondary-500 size-3.5 shrink-0" />
				</span>
				<span
					class={cn('text-base font-semibold', isEliteElo(elo) && 'font-bold tracking-wide')}
					style:color={elo != null ? getEloColor(elo) : undefined}
					style:text-shadow={getEloTextShadow(elo)}
				>
					{elo ?? '—'}
				</span>
			</div>
			<div class="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5">
				<span class="text-secondary-400 text-xs font-semibold tracking-wider uppercase">
					{cpmLabel}
				</span>
				<span class="text-primary text-xl leading-none font-bold tabular-nums">—</span>
			</div>
		</div>
	</div>
{/snippet}

{#snippet teamColumn(label: string, players: ReplayPlayer[])}
	<div class="min-w-0">
		<div
			class="bg-secondary-950/90 text-secondary-300 border-secondary-800 flex items-center gap-4 border-b px-4 py-2.5 text-sm font-semibold tracking-wide uppercase"
		>
			<span class="min-w-0 flex-1">{label}</span>
			<span class="text-right">{ratingLabel}</span>
			<span class="text-primary w-12 text-center font-semibold">{cpmLabel}</span>
		</div>
		{#each players as player, index (`${index}-${player.id ?? player.name}`)}
			{@render playerRow(player)}
		{/each}
	</div>
{/snippet}

{#snippet liveTeamColumn(label: string, players: LiveLobbyPlayer[])}
	<div class="min-w-0">
		<div
			class="bg-secondary-950/90 text-secondary-300 border-secondary-800 flex items-center gap-4 border-b px-4 py-2.5 text-sm font-semibold tracking-wide uppercase"
		>
			<span class="min-w-0 flex-1">{label}</span>
			<span class="text-right">{ratingLabel}</span>
			<span class="text-primary w-12 text-center font-semibold">{cpmLabel}</span>
		</div>
		{#each players as player (`${player.profileId ?? player.steamId ?? player.index}-${player.alias}`)}
			{@render livePlayerRow(player)}
		{/each}
	</div>
{/snippet}

<div class="divide-secondary-800 grid grid-cols-1 md:grid-cols-2 md:divide-x">
	{#if replay}
		{@render teamColumn(alliesLabel, teams.allies)}
		{@render teamColumn(axisLabel, teams.axis)}
	{:else}
		{@render liveTeamColumn(alliesLabel, liveTeams.allies)}
		{@render liveTeamColumn(axisLabel, liveTeams.axis)}
	{/if}
</div>
