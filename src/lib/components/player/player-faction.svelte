<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { upperCase } from 'lodash-es';
	import { usePlayer } from '.';
	import { getFactionFlagFromRace, getRacePrefix, getRankImage } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import { useLobby } from '../lobby';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const player = usePlayer();
	const lobby = useLobby();
	const stats = getLeaderboardStatsForPlayerByMatchType(lobby.matchType, player);
</script>

<span>
	<img
		src={await getFactionFlagFromRace(player.race)}
		alt={getRacePrefix(player.race)}
		title={upperCase(getRacePrefix(player.race))}
	/>
</span>
