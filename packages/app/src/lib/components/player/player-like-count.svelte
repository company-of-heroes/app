<script lang="ts">
	import { PlayerLikeCount as SharedPlayerLikeCount } from '@company-of-heroes/ui/player';
	import {
		likeCountForSteamId,
		preloadPlayerLikeCounts
	} from '$core/pocketbase/player-vote-cache.svelte';
	import { useOptionalPlayer } from './context';

	type Props = {
		/** Defaults to the `Player.Root` player; pass it outside a Root. */
		steamId?: string | null;
		likeCount?: number | null;
		showZero?: boolean;
		class?: string;
	};

	let {
		steamId: steamIdProp,
		likeCount = null,
		showZero = false,
		class: className
	}: Props = $props();
	const rootPlayer = useOptionalPlayer();
	const steamId = $derived(steamIdProp ?? rootPlayer()?.player.steamId ?? null);
	const resolved = $derived(likeCount ?? likeCountForSteamId(steamId));

	$effect(() => {
		if (likeCount == null && steamId) {
			preloadPlayerLikeCounts([steamId]);
		}
	});
</script>

<SharedPlayerLikeCount likeCount={resolved} {showZero} class={className} />
