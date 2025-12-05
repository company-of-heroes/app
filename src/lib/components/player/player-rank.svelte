<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { getRankImage } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import { useLobby } from '../lobby';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const player = usePlayer();
	const lobby = useLobby();
	const stats = getLeaderboardStatsForPlayerByMatchType(lobby.matchType, player);
</script>

<span class="flex items-center">
	{#if player.profile}
		<img
			src={await getRankImage(player.race, stats?.ranklevel)}
			alt="Rank"
			class="mr-2 h-6 w-6"
			{...restProps}
		/>
	{/if}
</span>
