<script lang="ts">
	import { PlayerLabels as SharedPlayerLabels } from '@company-of-heroes/ui/player';
	import {
		labelsForSteamId,
		preloadPlayerLabels
	} from '$core/pocketbase/player-label-cache.svelte';

	type Props = {
		steamId?: string | null;
		class?: string;
	};

	let { steamId, class: className }: Props = $props();
	const labels = $derived(labelsForSteamId(steamId));

	$effect(() => {
		if (steamId) {
			preloadPlayerLabels([steamId]);
		}
	});
</script>

<SharedPlayerLabels {labels} class={className} />
