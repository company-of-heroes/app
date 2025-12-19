<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import type { MatchHistoryPlayer } from '@fknoobs/app';
	import { createPlayer } from '.';

	type Props = {
		player: MatchHistoryPlayer;
		children?: Snippet;
	};

	let { player, children }: Props = $props();
	createPlayer(player);
	console.log(player);
</script>

{@render children?.()}
