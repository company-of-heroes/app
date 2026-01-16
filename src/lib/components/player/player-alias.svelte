<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { cn } from '$lib/utils';

	type Props = HTMLAnchorAttributes;

	const { ...restProps }: Props = $props();
	const { player } = $derived(usePlayer());
</script>

<a
	{...restProps}
	class={cn('hover:text-primary truncate transition-colors', restProps.class)}
	href="/leaderboards/profile/{player.playerId}"
>
	{player.profile?.alias ?? 'CPU'}
</a>
