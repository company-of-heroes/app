<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { tryUseHost } from '../host/host.context';
	import { isStreamer, isSupporter } from '../format/labels';
	import type { PlayerLabel } from '../format/types';
	import PlayerStreamerIcon from './player-streamer-icon.svelte';
	import PlayerSupporterMedal from './player-supporter-medal.svelte';

	type Props = {
		/** Labels already on hand; otherwise the host loads them for `steamId`. */
		labels?: PlayerLabel[] | null;
		steamId?: string | null;
		size?: number;
		class?: string;
	};

	let { labels, steamId, size = 16, class: className }: Props = $props();
	const host = tryUseHost();
	const resolved = $derived(
		labels ?? (steamId && host ? host.api.labels.forSteamId(steamId) : null)
	);
	const showMedal = $derived(isSupporter(resolved) && Boolean(host?.resolve.supporterMedal()));
	const showStreamer = $derived(isStreamer(resolved));
</script>

{#if showMedal || showStreamer}
	<span class={cn('inline-flex items-center gap-1', className)}>
		<PlayerSupporterMedal labels={resolved ?? []} {steamId} {size} />
		<PlayerStreamerIcon labels={resolved ?? []} {steamId} {size} />
	</span>
{/if}
