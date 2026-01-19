<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Match } from '$core/app/context';
	import { createLobby } from '.';

	type Props = {
		lobby: Match;
	} & HTMLAttributes<HTMLDivElement>;

	let { lobby, children, ...restProps }: Props = $props();
	createLobby(() => lobby);
</script>

<div {...restProps}>{@render children?.()}</div>
