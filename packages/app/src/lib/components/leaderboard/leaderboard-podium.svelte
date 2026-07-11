<script lang="ts">
	import type { LeaderboardStatWithProfile } from '@fknoobs/app';
	import { goto } from '$app/navigation';
	import { cn, getRankImageByLeaderboardId } from '$lib/utils';
	import { steam, type SteamPlayerSummary } from '$core/steam';
	import { resource } from 'runed';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { interactive } from '$lib/components/ui/variants';
	import { getSteamIdFromProfile, getStreakColor } from './leaderboard-utils';
	import Crown from 'phosphor-svelte/lib/Crown';

	type Props = {
		stats: LeaderboardStatWithProfile[];
		loading?: boolean;
	};

	let { stats, loading = false }: Props = $props();

	const podiumOrder = $derived.by(() => {
		const first = stats[0];
		const second = stats[1];
		const third = stats[2];
		return [second, first, third].filter((stat): stat is LeaderboardStatWithProfile => !!stat);
	});

	const steamProfiles = resource(
		() => stats.map((stat) => stat.profile.profile_id).join(','),
		async () => {
			const steamIds = stats.map((stat) => getSteamIdFromProfile(stat.profile)).filter(Boolean);
			if (steamIds.length === 0) return {} as Record<string, SteamPlayerSummary>;

			const profiles = await steam.getUserProfiles(steamIds);
			return Object.fromEntries(profiles.map((profile) => [profile.steamid, profile]));
		},
		{ initialValue: {} as Record<string, SteamPlayerSummary> }
	);

	function getSteamAvatar(stat: LeaderboardStatWithProfile): string | undefined {
		return steamProfiles.current[getSteamIdFromProfile(stat.profile)]?.avatarfull;
	}

	function getPodiumTier(rank: number) {
		switch (rank) {
			case 1:
				return {
					wrapper: 'min-w-0 w-full',
					card: 'border-[oklch(0.38_0.022_80)] bg-[oklch(0.325_0.012_80)] hover:bg-[oklch(0.34_0.014_80)] shadow-sm p-5 sm:min-h-72',
					skeleton: 'h-56 sm:h-72',
					rank: 'text-primary text-2xl',
					avatar: 'border-primary size-20',
					rankImage: 'h-10',
					name: 'text-primary text-2xl',
					showCrown: true
				};
			case 2:
				return {
					wrapper: 'min-w-0 w-full',
					card: 'border-secondary-700 bg-secondary-900 hover:bg-secondary-800 p-4 sm:min-h-60',
					skeleton: 'h-52 sm:h-60',
					rank: 'text-secondary-300 text-xl',
					avatar: 'size-[4.5rem]',
					rankImage: 'h-9',
					name: 'text-xl text-white',
					showCrown: false
				};
			default:
				return {
					wrapper: 'min-w-0 w-full',
					card: 'border-[oklch(0.38_0.02_58)] bg-[oklch(0.325_0.012_58)] hover:bg-[oklch(0.34_0.014_58)] p-4 sm:min-h-52',
					skeleton: 'h-48 sm:h-52',
					rank: 'text-secondary-300 text-lg',
					avatar: 'size-14',
					rankImage: 'h-7',
					name: 'text-lg text-white',
					showCrown: false
				};
		}
	}

	function navigate(profileId: number) {
		void goto(`/players/${profileId}`);
	}

	function handleKeydown(event: KeyboardEvent, profileId: number) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		navigate(profileId);
	}
</script>

<div class="mb-8 grid w-full grid-cols-1 items-center gap-4 sm:grid-cols-3">
	{#if loading}
		{#each [2, 1, 3] as rank (rank)}
			{@const tier = getPodiumTier(rank)}
			<div class={tier.wrapper}>
				<Skeleton class={cn('w-full rounded-lg', tier.skeleton)} />
			</div>
		{/each}
	{:else}
		{#each podiumOrder as stat (stat.profile.profile_id)}
			{@const tier = getPodiumTier(stat.rank)}
			{@const steamAvatar = getSteamAvatar(stat)}
			<div class={tier.wrapper}>
				<button
					type="button"
					class={cn(
						interactive,
						'border-secondary-800 flex w-full flex-col items-center justify-center gap-3 rounded-md border text-center transition-colors',
						'hover:border-primary/40',
						tier.card
					)}
					onclick={() => navigate(stat.profile.profile_id)}
					onkeydown={(event) => handleKeydown(event, stat.profile.profile_id)}
				>
				<div class="flex w-full items-center justify-between gap-2">
					<span class={cn('font-heading font-bold tabular-nums', tier.rank)}>
						#{stat.rank}
					</span>
					{#if tier.showCrown}
						<Crown class="text-primary size-6" weight="duotone" />
					{/if}
				</div>
				{#if steamProfiles.loading}
					<Skeleton class={cn('rounded-xl', tier.avatar)} />
				{:else if steamAvatar}
					<img
						src={steamAvatar}
						alt={stat.profile.alias}
						class={cn(
							'border-secondary-700 shrink-0 rounded-xl border-2 object-cover',
							tier.avatar
						)}
					/>
				{/if}
				<div class="flex items-center gap-2">
					{#await getRankImageByLeaderboardId(stat.leaderboard_id, stat.ranklevel) then rankImage}
						<img
							src={rankImage}
							alt={`Rank ${stat.ranklevel}`}
							class={cn('w-auto', tier.rankImage)}
						/>
					{/await}
					<span class="text-secondary-400 text-sm tabular-nums">Lvl {stat.ranklevel}</span>
				</div>
				<span class={cn('font-heading w-full truncate text-center font-bold', tier.name)}>
					{stat.profile?.alias}
				</span>
				<div class="grid w-full grid-cols-3 gap-3 text-center">
					<div>
						<span class="text-secondary-500 text-xs font-medium tracking-wide uppercase">Wins</span>
						<p class="text-success mt-0.5 font-semibold tabular-nums">{stat.wins}</p>
					</div>
					<div>
						<span class="text-secondary-500 text-xs font-medium tracking-wide uppercase">Losses</span>
						<p class="text-destructive/90 mt-0.5 font-semibold tabular-nums">{stat.losses}</p>
					</div>
					<div>
						<span class="text-secondary-500 text-xs font-medium tracking-wide uppercase">Streak</span>
						<p class="mt-0.5 font-semibold tabular-nums" style:color={getStreakColor(stat.streak)}>
							{stat.streak >= 0 ? '+' : ''}{stat.streak}
						</p>
					</div>
				</div>
			</button>
			</div>
		{/each}
	{/if}
</div>
