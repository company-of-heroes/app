<script lang="ts">
	import type { MatchHistoryPlayer, TransformedMatch } from '@fknoobs/app';
	import dayjs from '$lib/dayjs';
	import {
		cn,
		getFactionFlagFromRace,
		isSteamId,
		normalizeMapName
	} from '$lib/utils';
	import { steam, type SteamPlayerSummary } from '$core/steam';
	import { resource } from 'runed';
	import MapImage from '$lib/components/ui/map-image.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { surfacePanel, interactive } from '$lib/components/ui/variants';
	import { orderBy, sortBy, upperCase } from 'lodash-es';
	import ClockIcon from 'phosphor-svelte/lib/Clock';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import { page } from '$app/state';

	type Props = {
		matches: TransformedMatch[];
	};

	let { matches }: Props = $props();

	const orderedMatches = $derived(orderBy(matches, ['completiontime'], ['desc']));

	const steamProfiles = resource(
		() =>
			orderedMatches
				.flatMap((match) => match.players.map((player) => player.steamId))
				.join(','),
		async () => {
			const steamIds = [
				...new Set(
					orderedMatches.flatMap((match) =>
						match.players.map((player) => player.steamId).filter(Boolean)
					)
				)
			];

			if (steamIds.length === 0) return {} as Record<string, SteamPlayerSummary>;

			const profiles = await steam.getUserProfiles(steamIds.slice(0, 100));
			return Object.fromEntries(profiles.map((profile) => [profile.steamid, profile]));
		},
		{ initialValue: {} as Record<string, SteamPlayerSummary> }
	);

	const playerGrid =
		'grid grid-cols-[2.5rem_3.5rem_4rem_minmax(0,1fr)_3.5rem_3.5rem_3.5rem] items-center gap-3';

	function matchDuration(match: TransformedMatch): string {
		const seconds = dayjs.unix(match.completiontime).diff(dayjs.unix(match.startgametime), 'seconds');
		return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
	}

	function isCurrentProfile(player: MatchHistoryPlayer): boolean {
		const id = page.params.id;
		if (!id) return false;
		if (isSteamId(id)) return player.steamId === id;
		return player.profile_id === parseInt(id, 10);
	}

	function getSteamAvatar(steamId: string): string | undefined {
		return steamProfiles.current[steamId]?.avatarfull;
	}

	function ratingChange(player: MatchHistoryPlayer): number {
		return player.newrating - player.oldrating;
	}
</script>

{#if orderedMatches.length === 0}
	<p class="text-secondary-400 text-sm">No recent matches found.</p>
{:else}
	<div class="grid gap-4">
		{#each orderedMatches as match (match.id)}
			<article class={cn(surfacePanel, 'overflow-clip')}>
				<div class="border-secondary-800 flex items-center gap-4 border-b px-4 py-3">
					<MapImage small map={match.mapname} alt={normalizeMapName(match.mapname)} />
					<div class="min-w-0 grow">
						<h3 class="font-heading truncate text-lg font-bold">
							{normalizeMapName(match.mapname)}
						</h3>
						<p class="text-secondary-400 text-sm">
							{dayjs.unix(match.startgametime).format('MMM D, YYYY · HH:mm')}
						</p>
					</div>
					<span class="text-secondary-300 flex shrink-0 items-center gap-2 text-sm font-medium">
						<ClockIcon class="size-4" />
						{matchDuration(match)}
					</span>
				</div>
				<div
					class={cn(
						playerGrid,
						'bg-secondary-950/90 text-secondary-300 border-secondary-800 border-b px-4 py-2 text-xs font-semibold tracking-wide uppercase'
					)}
				>
					<span class="text-center">Team</span>
					<span class="text-center">ELO</span>
					<span class="text-center">Change</span>
					<span>Player</span>
					<span class="text-center">Wins</span>
					<span class="text-center">Losses</span>
					<span class="text-center">Streak</span>
				</div>
				{#each sortBy(match.players, ['teamid']) as player (player.profile_id)}
					{@const change = ratingChange(player)}
					{@const currentProfile = isCurrentProfile(player)}
					<div
						class={cn(
							playerGrid,
							'border-secondary-800 border-b px-4 py-3 last:border-b-0',
							player.outcome === 1 ? 'bg-success/5' : 'bg-destructive/5',
							currentProfile && 'bg-primary/5 ring-primary/30 ring-1 ring-inset'
						)}
					>
						{#await getFactionFlagFromRace(player.race_id) then flagImg}
							<img
								src={flagImg}
								alt=""
								class="mx-auto w-6 ring-1 ring-black/40"
							/>
						{/await}
						<span class="text-center font-medium tabular-nums">{player.newrating}</span>
						<span class="flex items-center justify-center gap-1 text-sm tabular-nums">
							{#if change < 0}
								<CaretDown class="text-destructive size-4" weight="duotone" />
								<span class="text-destructive/90">{Math.abs(change)}</span>
							{:else if change > 0}
								<CaretUp class="text-success size-4" weight="duotone" />
								<span class="text-success">{change}</span>
							{:else}
								<span class="text-secondary-500">—</span>
							{/if}
						</span>
						<a
							href="/players/{player.profile_id}"
							class={cn(
								interactive,
								'flex min-w-0 items-center gap-3 transition-colors hover:text-primary',
								currentProfile && 'text-primary font-semibold'
							)}
						>
							{#if steamProfiles.loading}
								<Skeleton class="size-9 shrink-0 rounded-lg" />
							{:else if getSteamAvatar(player.steamId)}
								<img
									src={getSteamAvatar(player.steamId)}
									alt={player.alias}
									class="size-9 shrink-0 rounded-lg border border-secondary-800 object-cover"
								/>
							{/if}
							{#if player.country}
								<img
									class="size-4 shrink-0"
									src="https://flagsapi.com/{upperCase(player.country)}/shiny/64.png"
									alt={player.country}
								/>
							{/if}
							<span class="truncate">{player.alias}</span>
						</a>
						<span class="text-success text-center font-medium tabular-nums">{player.wins}</span>
						<span class="text-destructive/90 text-center font-medium tabular-nums">{player.losses}</span>
						<span
							class={cn(
								'text-center font-medium tabular-nums',
								player.streak > 0 ? 'text-success' : player.streak < 0 ? 'text-destructive/90' : 'text-secondary-400'
							)}
						>
							{player.streak > 0 ? `+${player.streak}` : player.streak}
						</span>
					</div>
				{/each}
			</article>
		{/each}
	</div>
{/if}
