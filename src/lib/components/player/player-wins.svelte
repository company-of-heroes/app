<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { upperCase } from 'lodash-es';
	import { usePlayer } from '.';
	import { useLobby } from '../lobby';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();

	const lobby = useLobby();
	const player = usePlayer();
	const stats = getLeaderboardStatsForPlayerByMatchType(lobby.matchType, player);

	console.log(lobby.matchType, lobby.type);
</script>

{#if player.profile}
	<span class="text-center" {...restProps}>{stats ? stats.wins : '-'}</span>
{/if}
