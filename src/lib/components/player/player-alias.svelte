<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { usePlayer } from '.';

	type Props = HTMLAnchorAttributes;

	const { ...restProps }: Props = $props();
	const player = usePlayer();
</script>

<a
	class="hover:text-primary truncate transition-colors"
	href="/leaderboards/profile/{player.profile_id}"
	{...restProps}
>
	{player.alias}
</a>
