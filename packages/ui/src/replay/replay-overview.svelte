<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		formatStreak,
		interactive,
		mePlayerText,
		statLosses,
		statWins,
		factionIcon
	} from '@company-of-heroes/ui/variants';
	import { getEloColor, getEloTextShadow, isEliteElo } from '../format/player-format';
	import type {
		CommunityMatchDetail,
		CommunityPlayer,
		MatchResultPlayer,
		ReplayPlayer
	} from './types';
	import { useOptionalReplayData } from './context';
	import { findResultPlayer, isCpuPlayerName, isCpuReplayPlayer } from './utils';
	import {
		isCpuLiveLobbyPlayer,
		teamPlayers,
		type LiveLobbyPlayer,
		type LiveLobbyPlayerStats
	} from '../live-lobby/types';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import MinusIcon from 'phosphor-svelte/lib/MinusIcon';
	import PlayerLikeCount from '../player/player-like-count.svelte';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import PlayerStreamerIcon from '../player/player-streamer-icon.svelte';
	import { playerPreviewId } from '../player/player-preview-cache';
	import { countryDisplayName } from '../format/country';
	import { liveLobbyPlayerHref, liveLobbyPlayerLabel } from '../live-lobby/links';
	import { communityPlayerHref } from './links';
	import { doctrineBannerFile, playerCpm, raceFromReplayFaction } from './replay-stats';
	import { useHost } from '../host/host.context';
	import { escapeHtml, tooltip } from '../attachments';

	type NameExtraArgs = {
		name: string;
		steamId: string | null;
		profileId: number | null;
	};

	type Props = {
		match: CommunityMatchDetail;
		livePlayers?: LiveLobbyPlayer[];
		/** Hide rank badges / positions (e.g. local replays without ranked data). */
		showRanks?: boolean;
		/** Defaults to the viewer's own alias. */
		isHighlightedName?: (name: string) => boolean;
		nameExtra?: Snippet<[NameExtraArgs]>;
	};

	const { t } = useI18n();
	const host = useHost();

	let {
		match,
		livePlayers = [],
		showRanks = true,
		isHighlightedName = (name: string) => host.auth.isSelfAlias(name),
		nameExtra
	}: Props = $props();

	// Inside `Replay.Root` the overview adds replay data (CPM, doctrines); a match without one renders without.
	const replayData = useOptionalReplayData();
	const replay = $derived(replayData?.replay ?? null);
	const getRankImage = $derived(showRanks ? host.resolve.rankImageByRace : undefined);
	const getCountryDisplayName = (country: string | null | undefined) =>
		countryDisplayName(country, host.locale());

	const playerHref = (player: CommunityPlayer) => communityPlayerHref(player, host.routes);

	const livePlayerHref = (player: LiveLobbyPlayer) => liveLobbyPlayerHref(player, host.routes);
	const livePlayerLabel = (player: LiveLobbyPlayer) => liveLobbyPlayerLabel(player, t);

	function doctrineBannerUrl(player: ReplayPlayer): string | null {
		const file = doctrineBannerFile(player);
		return file ? host.resolve.doctrineBanner(file) : null;
	}

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
			!isCpuPlayerName(match.players[index].profile.alias) &&
			match.players[index].profile.alias.trim() !== ''
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
					!isCpuPlayerName(player.alias) && (player.alias ?? '').trim().toLowerCase() === name
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
				(player) => !isCpuLiveLobbyPlayer(player) && player.alias.trim().toLowerCase() === key
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
			<span class="text-secondary-400">{t('Lv')}</span>
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
			(live ? livePlayerHref(live) : null) ??
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
	{@const liveStats = live?.stats ?? liveStatsForReplay(player)}
	{@const elo = result ? displayElo(result) : (liveStats?.elo ?? null)}
	{@const change = result ? ratingDelta(result) : undefined}
	{@const record = result
		? { wins: result.wins ?? 0, losses: result.losses ?? 0, streak: result.streak ?? 0 }
		: (liveStats ?? null)}
	{@const race = result?.race_id ?? lobby?.race ?? raceFromReplayFaction(player.faction)}
	{@const banner = doctrineBannerUrl(player)}
	{@const country = result?.country ?? live?.country ?? null}
	{@const flagUrl = host.resolve.flagImageUrl(country)}
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
							{@attach tooltip(escapeHtml(countryName ?? ''))}
							class="h-4 w-auto shrink-0 rounded-xs"
						/>
					{/if}
					{#if !cpu}
						<PlayerLikeCount likeCount={likeCountForSteamId(steamId)} class="shrink-0" />
					{/if}
					{#if !cpu}
						<PlayerStreamerIcon {steamId} />
					{/if}
					{#if href}
						{@const previewId = playerPreviewId({ steamId, profileId })}
						{#if previewId}
							<PlayerProfileLink
								{href}
								playerId={previewId}
								class={cn(interactive, nameTextClass(player.name), 'hover:text-primary')}
							>
								{player.name}
							</PlayerProfileLink>
						{:else}
							<a {href} class={cn(interactive, nameTextClass(player.name), 'hover:text-primary')}>
								{player.name}
							</a>
						{/if}
					{:else}
						<span class={nameTextClass(player.name)}>{player.name}</span>
					{/if}
					{#if !cpu}
						{@render nameExtra?.({ name: player.name, steamId, profileId })}
						{@render position(liveStats?.rank)}
					{/if}
				</div>
				<div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base tabular-nums">
					<img src={host.resolve.factionFlagByRace(race ?? 0)} alt="" class={factionIcon} />
					<span class="text-secondary-200 truncate">
						{player.doctrineName || t('Unknown doctrine')}
					</span>
					{#if !cpu}
						{@render rankBadge(race ?? 0, liveStats?.rankLevel)}
					{/if}
					{#if record}
						<span class="text-secondary-600" aria-hidden="true">·</span>
						<span class="inline-flex items-center gap-1">
							<span class={statWins}>{record.wins}</span>
							<span class="text-secondary-500">/</span>
							<span class={statLosses}>{record.losses}</span>
						</span>
						{#if record.streak}
							<span class="text-secondary-600" aria-hidden="true">·</span>
							<span
								class={record.streak > 0
									? 'text-green-300'
									: record.streak < 0
										? 'text-red-300'
										: 'text-secondary-400'}
							>
								{formatStreak(record.streak)}
							</span>
						{/if}
					{/if}
				</div>
			</div>
			{#if result || elo != null}
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
					{t('CPM')}
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
	{@const flagUrl = host.resolve.flagImageUrl(country)}
	{@const countryName = getCountryDisplayName(country)}
	<div class="border-secondary-800 relative overflow-hidden border-b last:border-b-0">
		<div class="relative flex items-center gap-4 px-4 py-3.5">
			<div class="min-w-0 flex-1">
				<div class="flex min-w-0 items-center gap-2">
					{#if flagUrl}
						<img
							src={flagUrl}
							alt={countryName ?? country ?? ''}
							{@attach tooltip(escapeHtml(countryName ?? ''))}
							class="h-4 w-auto shrink-0 rounded-xs"
						/>
					{/if}
					{#if !cpu}
						<PlayerLikeCount likeCount={player.likeCount} class="shrink-0" />
					{/if}
					{#if !cpu}
						<PlayerStreamerIcon steamId={player.steamId} />
					{/if}
					{#if href}
						{@const previewId = playerPreviewId({
							steamId: player.steamId,
							profileId: player.profileId
						})}
						{#if previewId}
							<PlayerProfileLink
								{href}
								playerId={previewId}
								class={cn(interactive, nameTextClass(label), 'hover:text-primary')}
							>
								{label}
							</PlayerProfileLink>
						{:else}
							<a {href} class={cn(interactive, nameTextClass(label), 'hover:text-primary')}>
								{label}
							</a>
						{/if}
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
					<img src={host.resolve.factionFlagByRace(player.race)} alt="" class={factionIcon} />
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
								{formatStreak(stats.streak)}
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
					{t('CPM')}
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
			<span class="text-right">{t('Rating')}</span>
			<span class="text-primary w-12 text-center font-semibold">{t('CPM')}</span>
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
			<span class="text-right">{t('Rating')}</span>
			<span class="text-primary w-12 text-center font-semibold">{t('CPM')}</span>
		</div>
		{#each players as player (`${player.profileId ?? player.steamId ?? player.index}-${player.alias}`)}
			{@render livePlayerRow(player)}
		{/each}
	</div>
{/snippet}

<div class="divide-secondary-800 grid grid-cols-1 md:grid-cols-2 md:divide-x">
	{#if replay}
		{@render teamColumn(t('Allies'), teams.allies)}
		{@render teamColumn(t('Axis'), teams.axis)}
	{:else}
		{@render liveTeamColumn(t('Allies'), liveTeams.allies)}
		{@render liveTeamColumn(t('Axis'), liveTeams.axis)}
	{/if}
</div>
