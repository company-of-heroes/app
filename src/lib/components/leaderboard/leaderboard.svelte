<script lang="ts">
	import type { LeaderboardStat } from '@fknoobs/app';
	import { cn, getRankImage } from '$lib/utils';
	import {
		getFactionFlagFromLeaderboardId,
		getLeaderboardType,
		getRaceFromLeaderboardId,
		isRanked
	} from '$lib/utils/game';
	import { orderBy, sortBy } from 'lodash-es';

	type Props = {
		stats: LeaderboardStat[];
	};

	let { stats }: Props = $props();
</script>

<div class={cn('flex grow flex-col')}>
	<div
		class={cn(
			'border-gray-600 bg-gray-700 text-gray-300',
			'grid grid-cols-[12rem_12rem_4rem_25%_1fr_1fr_1fr] items-center gap-1 rounded-md border',
			'[&>span]:flex [&>span]:h-10 [&>span]:items-center [&>span]:px-4 [&>span]:font-semibold'
		)}
	>
		<span class="justify-center">Level</span>
		<span class="justify-center">Type</span>
		<span class="justify-center">Faction</span>
		<span class="justify-center">Position</span>
		<span class="justify-center">Wins</span>
		<span class="justify-center">Losses</span>
		<span class="justify-center">Streak</span>
	</div>
	{#each sortBy( orderBy(stats, 'ranklevel', 'desc'), (o) => (isRanked(o.leaderboard_id) ? 0 : 1) ) as stat}
		<div
			class={cn(
				'border-b border-gray-700 odd:bg-gray-800',
				'grid grid-cols-[12rem_12rem_4rem_25%_1fr_1fr_1fr] items-center gap-1',
				'text-gray-100 [&>span]:flex [&>span]:h-10 [&>span]:items-center [&>span]:px-4'
			)}
		>
			<span class="justify-center gap-4 font-semibold">
				{#await getRankImage(getRaceFromLeaderboardId(stat.leaderboard_id), stat.ranklevel) then rankImg}
					{#if isRanked(stat.leaderboard_id)}
						<img src={rankImg} alt="Rank" class="w-8" />
					{/if}
				{/await}
				{#if isRanked(stat.leaderboard_id)}
					{stat.ranklevel}
				{/if}
			</span>
			<span class="justify-center">{getLeaderboardType(stat.leaderboard_id)}</span>
			<span class="justify-center">
					<img src={getFactionFlagFromLeaderboardId(stat.leaderboard_id)} alt="Faction Flag" class="w-6 ring ring-black" />
				</span>
			<span class="items-center justify-center gap-2">
				{#if stat.rank === 1}
					<span class="relative -top-0.5">👑</span>
				{/if}
				<span class={cn(stat.rank === 1 && 'text-primary font-bold')}>
					{stat.rank === -1 ? '-' : stat.rank}
				</span>
			</span>
			<span class="justify-center text-green-200">{stat.wins}</span>
			<span class="justify-center text-red-200">{stat.losses}</span>
			<span class={cn('justify-center', stat.streak < 0 ? 'text-red-400' : 'text-green-400')}>
				{stat.streak >= 0 ? '+' : ''}{stat.streak}
			</span>
		</div>
	{/each}
</div>
