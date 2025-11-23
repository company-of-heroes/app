<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import { useLobby } from '../lobby';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();

	const lobby = useLobby();
	const player = usePlayer();
	const stats = $derived(getLeaderboardStatsForPlayerByMatchType(lobby.matchType, player));
</script>

{#if player.profile}
	<span class="text-center" {...restProps}>{stats ? stats.losses : '-'}</span>
{/if}
