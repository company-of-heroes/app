<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { usePlayer } from '.';

	type Props = HTMLAnchorAttributes;

	const { ...restProps }: Props = $props();
	const { player } = usePlayer();
</script>

<a
	class="hover:text-primary truncate transition-colors"
	href="/leaderboards/profile/{player.playerId}"
	{...restProps}
>
	{player.profile?.alias ?? 'CPU'}
</a>
