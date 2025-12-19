<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { createContext, type Snippet } from 'svelte';
	import type { LeaderboardStat, LobbyPlayer, MatchHistoryPlayer } from '@fknoobs/app';
	import { createPlayer } from '.';

	type Props = {
		player: LobbyPlayer;
		playerResult?: MatchHistoryPlayer;
		stats?: LeaderboardStat;
		children?: Snippet;
	};

	let { player, playerResult, stats, children }: Props = $props();
	createPlayer(player, playerResult, stats);
</script>

{@render children?.()}
