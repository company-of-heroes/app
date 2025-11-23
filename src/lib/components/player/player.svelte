<script lang="ts">
	import type { LobbyPlayer } from '@fknoobs/app';
	import { createPlayer } from '.';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	type Props = {
		player: LobbyPlayer;
		children?: Snippet;
	} & HTMLAttributes<HTMLDivElement>;

	let { player, children, ...restProps }: Props = $props();
	createPlayer(player);
</script>

<div {...restProps}>
	{@render children?.()}
</div>
