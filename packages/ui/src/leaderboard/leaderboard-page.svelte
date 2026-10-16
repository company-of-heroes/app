<script lang="ts">
	import { useHost } from '../host/host.context';
	import { createLeaderboard } from './context';
	import { LeaderboardState, type LeaderboardBoard } from './leaderboard-state.svelte';
	import LeaderboardCountries from './leaderboard-countries.svelte';
	import LeaderboardFilters from './leaderboard-filters.svelte';
	import LeaderboardList from './leaderboard-list.svelte';
	import LeaderboardMovers from './leaderboard-movers.svelte';
	import LeaderboardOwn from './leaderboard-own.svelte';
	import LeaderboardPodium from './leaderboard-podium.svelte';
	import LeaderboardSkeleton from './leaderboard-skeleton.svelte';
	import LeaderboardStreaks from './leaderboard-streaks.svelte';
	import LeaderboardToolbar from './leaderboard-toolbar.svelte';

	type Props = {
		boardId: number;
		/** null while the board loads. */
		board: LeaderboardBoard | null;
		/** The host navigates (URL param, local state); `boardId` follows. */
		onBoardChange: (boardId: number) => void;
		/** Height of a sticky host header, so the table head and side panel stick below it. */
		stickyTop?: string;
	};

	let { boardId, board, onBoardChange, stickyTop = '0px' }: Props = $props();

	const leaderboard = createLeaderboard(
		new LeaderboardState({
			boardId: () => boardId,
			board: () => board,
			onBoardChange: (id) => onBoardChange(id),
			host: useHost()
		})
	);
</script>

<div style:--leaderboard-top={stickyTop}>
	<LeaderboardToolbar />
	<div class="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
		<div class="border-secondary-800 min-w-0 lg:border-r">
			{#if leaderboard.loading}
				<LeaderboardSkeleton />
			{:else}
				{#if leaderboard.showPodium}
					<LeaderboardPodium />
				{/if}
				<LeaderboardFilters />
				<LeaderboardList />
			{/if}
		</div>
		<aside
			class="max-lg:order-first lg:sticky lg:top-(--leaderboard-top) lg:max-h-[calc(100vh-var(--leaderboard-top))] lg:self-start lg:overflow-y-auto"
		>
			<LeaderboardOwn />
			<LeaderboardMovers />
			<div class="max-lg:hidden">
				<LeaderboardStreaks />
				<LeaderboardCountries />
			</div>
		</aside>
	</div>
</div>
