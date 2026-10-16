<script lang="ts">
	import CountryFlag from '../player/country-flag.svelte';
	import RankIcon from '../player/rank-icon.svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { formatStreak, interactive, statStreakClass } from '@company-of-heroes/ui/variants';
	import CrownIcon from 'phosphor-svelte/lib/CrownIcon';
	import { useHost } from '../host/host.context';
	import PlayerLabels from '../player/player-labels.svelte';
	import PlayerNameIcons from '../player/player-name-icons.svelte';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import { useLeaderboard } from './context';
	import { steamIdOf } from './highlights';
	import { leaderboardRowId } from './leaderboard-state.svelte';
	import LeaderboardChange from './leaderboard-change.svelte';
	import LeaderboardElo from './leaderboard-elo.svelte';
	import LeaderboardRecord from './leaderboard-record.svelte';

	const { t } = useI18n();
	const host = useHost();
	const leaderboard = useLeaderboard();

	const podium = $derived(leaderboard.rows.slice(0, 3));

	const medal: Record<number, { text: string; ring: string; surface: string }> = {
		1: {
			text: 'text-primary',
			ring: 'ring-primary/60',
			surface: 'from-primary/[0.12] to-transparent'
		},
		2: {
			text: 'text-secondary-200',
			ring: 'ring-secondary-300/40',
			surface: 'from-secondary-300/[0.06] to-transparent'
		},
		3: {
			text: 'text-amber-600',
			ring: 'ring-amber-700/50',
			surface: 'from-amber-700/[0.08] to-transparent'
		}
	};
</script>

<div
	class="border-secondary-800 sm:divide-secondary-800 grid grid-cols-1 border-b sm:grid-cols-3 sm:items-stretch sm:divide-x"
>
	{#each podium as stat (stat.profile.profile_id)}
		{@const style = medal[stat.rank] ?? medal[3]}
		{@const first = stat.rank === 1}
		<PlayerProfileLink
			id={leaderboardRowId(stat.profile.profile_id)}
			href={host.routes.player(stat.profile.profile_id)}
			class={cn(
				interactive,
				'group relative flex min-w-0 flex-col items-center gap-3 bg-linear-to-b px-4 text-center transition-colors',
				'hover:bg-secondary-950/40 max-sm:border-secondary-800 max-sm:not-last:border-b',
				style.surface,
				first ? 'py-7' : 'py-5 sm:pt-10',
				leaderboard.isOwn(stat) && 'shadow-[inset_0_2px_0_var(--color-primary)]',
				leaderboard.flashed === stat.profile.profile_id && 'bg-primary/20'
			)}
		>
			<div class="absolute top-3 right-4 left-4 flex items-center justify-between">
				<span class={cn('font-heading text-lg font-bold tabular-nums', style.text)}>
					#{stat.rank}
				</span>
				<LeaderboardChange change={stat.change?.day} class="text-xs" />
			</div>
			<div class="relative">
				{#if first}
					<CrownIcon
						class="text-primary absolute -top-5 left-1/2 size-6 -translate-x-1/2"
						weight="duotone"
					/>
				{/if}
				{#if stat.profile.avatarUrl}
					<img
						decoding="async"
						src={host.resolve.avatarUrl(stat.profile.avatarUrl)}
						alt=""
						class={cn(
							'rounded-xl object-cover ring-2 ring-offset-2 ring-offset-gray-950',
							style.ring,
							first ? 'size-20' : 'size-16'
						)}
					/>
				{:else}
					<div
						class={cn(
							'bg-secondary-800 rounded-xl ring-2 ring-offset-2 ring-offset-gray-950',
							style.ring,
							first ? 'size-20' : 'size-16'
						)}
					></div>
				{/if}
				<RankIcon
					level={stat.ranklevel}
					leaderboardId={stat.leaderboard_id}
					position={stat.rank}
					class="absolute -right-3 -bottom-2 size-auto h-8 drop-shadow"
				/>
			</div>
			<div class="flex w-full min-w-0 items-center justify-center gap-2">
				<CountryFlag country={stat.profile.country} class="h-4" />
				<PlayerNameIcons labels={stat.profile.labels} steamId={steamIdOf(stat)} size={20} />
				<span
					class={cn(
						'font-heading group-hover:text-primary truncate font-bold transition-colors',
						first ? 'text-primary text-2xl' : 'text-xl text-white'
					)}
				>
					{stat.profile.alias}
				</span>
				<PlayerLabels labels={stat.profile.labels} class="shrink-0" />
			</div>
			<div class="flex items-center gap-2 text-sm">
				<LeaderboardElo elo={leaderboard.elo(stat)} />
				<span class={statStreakClass(stat.streak)}>
					{t('{streak} streak', { streak: formatStreak(stat.streak) })}
				</span>
			</div>
			<LeaderboardRecord wins={stat.wins} losses={stat.losses} class="w-full max-w-60" />
		</PlayerProfileLink>
	{/each}
</div>
