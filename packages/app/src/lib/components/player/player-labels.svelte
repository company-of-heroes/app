<script lang="ts">
	import { PlayerLabels as SharedPlayerLabels } from '@company-of-heroes/ui/player';
	import {
		labelsForSteamId,
		preloadPlayerLabels
	} from '$core/pocketbase/player-label-cache.svelte';
	import { useOptionalPlayer } from './context';

	type Props = {
		/** Defaults to the `Player.Root` player; pass it outside a Root. */
		steamId?: string | null;
		class?: string;
	};

	let { steamId: steamIdProp, class: className }: Props = $props();
	const rootPlayer = useOptionalPlayer();
	const steamId = $derived(steamIdProp ?? rootPlayer()?.player.steamId ?? null);
	const labels = $derived(labelsForSteamId(steamId));

	$effect(() => {
		if (steamId) {
			preloadPlayerLabels([steamId]);
		}
	});
</script>

<SharedPlayerLabels {labels} class={className} />
