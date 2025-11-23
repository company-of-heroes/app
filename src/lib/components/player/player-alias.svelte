<script lang="ts">
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import { usePlayer } from '.';

	type Props = HTMLAnchorAttributes;

	const { ...restProps }: Props = $props();
	const player = usePlayer();
</script>

{#if player.profile}
	<a
		class="hover:text-primary truncate transition-colors"
		href="/leaderboards/profile/{player.profile.profile_id}"
		{...restProps}
	>
		{player.profile.alias}
	</a>
{/if}
