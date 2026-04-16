<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LeaderboardStat, LobbyPlayer, MatchHistoryPlayer } from '@fknoobs/app';
	import { createPlayer } from '.';

	type Props = {
		player: LobbyPlayer;
		playerResult?: MatchHistoryPlayer;
		stats?: LeaderboardStat;
		race?: number;
		children?: Snippet;
	};

	let { player, playerResult, stats, race, children }: Props = $props();
	createPlayer(() => ({ player, playerResult, stats, race }));
</script>

{@render children?.()}
