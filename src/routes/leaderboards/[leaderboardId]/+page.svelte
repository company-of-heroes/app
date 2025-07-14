<script lang="ts">
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import { cn, getRankImage } from '$lib/utils';
	import { Select } from '$lib/components/ui/input';
	import { goto } from '$app/navigation';

	const { data }: PageProps = $props();
	let { leaderboardId } = $derived(page.params);

	function getRatioColor(wins: number, losses: number): string {
		if (losses === 0) return wins > 0 ? 'text-lime-600' : 'text-gray-400';

		const ratio = wins / losses;

		if (ratio >= 5) return 'text-lime-600/70';
		if (ratio >= 4) return 'text-lime-500/70';
		if (ratio >= 3) return 'text-lime-400/70';
		if (ratio >= 2) return 'text-lime-300/70';
		if (ratio >= 1) return 'text-lime-200/70';

		return 'text-lime-100/70';
	}

	$effect(() => {
		goto(`/leaderboards/${leaderboardId}`, { replaceState: true });
	});
</script>

<form>
	<Select
		type="single"
		items={[
			{ label: '1v1', value: '4' },
			{ label: '2v2', value: '8' },
			{ label: '3v3', value: '12' },
			{ label: '4v4', value: '16' }
		]}
		bind:value={leaderboardId}
	/>
</form>

<div class={cn('flex flex-grow flex-col gap-1')}>
	<div
		class={cn(
			'flex items-center gap-0.5',
			'[&>span]:bg-secondary-800 [&>span]:flex [&>span]:h-10 [&>span]:items-center [&>span]:px-4'
		)}
	>
		<span class="flex w-12 justify-center">#</span>
		<span class="flex w-24">Rank</span>
		<span class="flex-grow">Player</span>
		<span class="flex w-28 justify-center">Wins</span>
		<span class="flex w-28 justify-center">Losses</span>
		<span class="flex w-28 justify-center">Streak</span>
		<span class="flex w-28 justify-center">Ratio</span>
	</div>
	{#each data.stats as stat}
		<div
			class={cn(
				'flex items-center gap-0.5',
				'[&>span]:bg-primary/5 [&>span]:flex [&>span]:h-10 [&>span]:items-center [&>span]:px-4'
			)}
		>
			<span class="flex w-12 justify-center">{stat.rank}</span>
			<span class="relative flex w-24 items-center gap-4">
				{#await getRankImage(0, stat.ranklevel) then rankImage}
					<img src={rankImage} alt={`${stat.ranklevel}`} class="relative w-6" />
				{/await}
				<span class="relative top-[1px] text-lg font-bold text-white">{stat.ranklevel}</span>
			</span>
			<span class="text-primary-50 flex-grow font-bold">{stat.profile?.alias}</span>
			<span class="flex w-28 justify-center">{stat.wins}</span>
			<span class="flex w-28 justify-center text-red-100">{stat.losses}</span>
			<span
				class={cn('flex w-28 justify-center', stat.streak < 0 ? 'text-red-500' : 'text-green-600')}
				>{stat.streak}</span
			>
			<span class={cn('flex w-28 justify-center font-bold', getRatioColor(stat.wins, stat.losses))}>
				{stat.losses > 0 ? (stat.wins / stat.losses).toFixed(2) : stat.wins > 0 ? '∞' : '0.00'}
			</span>
		</div>
	{/each}
</div>
