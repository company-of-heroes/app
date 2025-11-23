<script lang="ts">
	import type { Lobby } from '$core/company-of-heroes';
	import type { HTMLAttributes } from 'svelte/elements';
	import { createLobby } from '.';

	type Props = {
		lobby: Lobby;
	} & HTMLAttributes<HTMLDivElement>;

	let { lobby, children, ...restProps }: Props = $props();
	createLobby(lobby);
</script>

<div {...restProps}>{@render children?.()}</div>
