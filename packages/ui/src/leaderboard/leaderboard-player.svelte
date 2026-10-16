<script lang="ts">
	import CountryFlag from '../player/country-flag.svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import type { LeaderboardStatRow } from '../format/types';
	import PlayerLabels from '../player/player-labels.svelte';
	import PlayerStreamerIcon from '../player/player-streamer-icon.svelte';
	import PlayerLikeCount from '../player/player-like-count.svelte';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import PlayerClaimButton from '../player/player-claim-button.svelte';
	import { steamIdOf } from './highlights';

	type Props = {
		stat: LeaderboardStatRow;
		/** Only the alias and flag (side panel lists). */
		compact?: boolean;
		class?: string;
	};

	const host = useHost();

	let { stat, compact = false, class: className }: Props = $props();

	const steamId = $derived(steamIdOf(stat));
</script>

<div class={cn('flex min-w-0 items-center gap-3', className)}>
	<PlayerProfileLink
		href={host.routes.player(stat.profile.profile_id)}
		class={cn(interactive, 'hover:text-primary flex min-w-0 items-center gap-2 font-medium')}
	>
		<CountryFlag country={stat.profile.country} class="h-3.5" />
		{#if !compact}
			<PlayerLikeCount likeCount={stat.profile.likeCount} class="shrink-0" />
			<PlayerStreamerIcon labels={stat.profile.labels} {steamId} />
		{/if}
		<span class="truncate">{stat.profile.alias}</span>
		{#if !compact}
			<PlayerLabels labels={stat.profile.labels} class="shrink-0" />
		{/if}
	</PlayerProfileLink>
	{#if !compact && stat.profile.claimed === false}
		<PlayerClaimButton {steamId} compact />
	{/if}
</div>
