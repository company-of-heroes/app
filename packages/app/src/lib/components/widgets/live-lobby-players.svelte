<script lang="ts">
	import type { LiveLobby } from '$core/app/database/lobbies-live';
	import type { LobbyPlayer } from '@fknoobs/app';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn, getFactionFlagFromRace, normalizeMapName } from '$lib/utils';
	import { interactive } from '$lib/components/ui/variants';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import { steam, type SteamPlayerSummary } from '$core/steam';
	import { resource } from 'runed';
	import { tooltip } from '$lib/attachments';
	import { sortBy, upperCase } from 'lodash-es';
	import {
		getLiveLobbyMatchType,
		getPlayerAlias,
		getPlayerProfileId
	} from './dashboard-utils';

	type Props = {
		lobby: LiveLobby;
	};

	let { lobby }: Props = $props();

	const matchType = $derived(getLiveLobbyMatchType(lobby.players, lobby.isRanked));
	const players = $derived(sortBy(lobby.players ?? [], ['team', 'index']));
	const steamIds = $derived(
		players.map((player) => player.steamId).filter((steamId): steamId is string => Boolean(steamId))
	);

	const steamProfiles = resource(
		() => steamIds.join(','),
		async () => {
			if (steamIds.length === 0) return {} as Record<string, SteamPlayerSummary>;

			const profiles = await steam.getUserProfiles([...new Set(steamIds)].slice(0, 100));
			return Object.fromEntries(profiles.map((profile) => [profile.steamid, profile]));
		},
		{ initialValue: {} as Record<string, SteamPlayerSummary> }
	);

	const playerGrid =
		'grid grid-cols-[2.5rem_3.5rem_4rem_minmax(0,1fr)_3.5rem_3.5rem_3.5rem] items-center gap-3';

	function playerStats(player: LobbyPlayer) {
		return getLeaderboardStatsForPlayerByMatchType(matchType, player);
	}

	function getSteamAvatar(steamId?: string) {
		if (!steamId) return undefined;
		return steamProfiles.current[steamId]?.avatarfull;
	}
</script>

<div class="border-secondary-800 bg-secondary-950/90 border-t">
	<div
		class={cn(
			playerGrid,
			'text-secondary-300 border-secondary-800 border-b px-4 py-2 text-xs font-semibold tracking-wide uppercase'
		)}
	>
		<span class="text-center">Team</span>
		<span class="text-center">ELO</span>
		<span class="text-center">Rank</span>
		<span>Player</span>
		<span class="text-center">Wins</span>
		<span class="text-center">Losses</span>
		<span class="text-center">Streak</span>
	</div>
	{#each players as player (player.index)}
		{@const stats = playerStats(player)}
		{@const profileId = getPlayerProfileId(player)}
		{@const isCpu = player.playerId === -1}
		<div class={cn(playerGrid, 'border-secondary-800 border-b px-4 py-3 last:border-b-0')}>
			<img
				src={getFactionFlagFromRace(player.race)}
				alt=""
				class="mx-auto w-6 ring-1 ring-black/40"
			/>
			<span class="text-center font-medium tabular-nums">
				{#if stats}
					{stats.rank}
				{:else}
					<span class="text-secondary-500">—</span>
				{/if}
			</span>
			<span class="text-secondary-400 text-center text-sm tabular-nums">
				{#if stats}
					{stats.ranklevel}
				{:else}
					—
				{/if}
			</span>
			{#if isCpu || !profileId}
				<span class="text-secondary-400 truncate">CPU</span>
			{:else}
				<a
					href="/players/{profileId}"
					class={cn(
						interactive,
						'flex min-w-0 items-center gap-3 transition-colors hover:text-primary'
					)}
					onclick={(event) => event.stopPropagation()}
				>
					{#if steamProfiles.loading && player.steamId}
						<Skeleton class="size-9 shrink-0 rounded-lg" />
					{:else if getSteamAvatar(player.steamId)}
						<img
							src={getSteamAvatar(player.steamId)}
							alt={getPlayerAlias(player)}
							class="border-secondary-800 size-9 shrink-0 rounded-lg border object-cover"
						/>
					{/if}
					{#if player.profile?.country}
						<img
							class="size-4 shrink-0"
							src="https://flagsapi.com/{upperCase(player.profile.country)}/shiny/64.png"
							alt={player.profile.country}
						/>
					{/if}
					<span class="truncate">{getPlayerAlias(player)}</span>
				</a>
			{/if}
			<span class="text-success text-center font-medium tabular-nums">
				{#if stats}
					{stats.wins}
				{:else}
					—
				{/if}
			</span>
			<span class="text-destructive/90 text-center font-medium tabular-nums">
				{#if stats}
					{stats.losses}
				{:else}
					—
				{/if}
			</span>
			<span
				class={cn(
					'text-center font-medium tabular-nums',
					stats && stats.streak > 0
						? 'text-success'
						: stats && stats.streak < 0
							? 'text-destructive/90'
							: 'text-secondary-400'
				)}
			>
				{#if stats}
					{stats.streak > 0 ? `+${stats.streak}` : stats.streak}
				{:else}
					—
				{/if}
			</span>
		</div>
	{/each}
</div>
