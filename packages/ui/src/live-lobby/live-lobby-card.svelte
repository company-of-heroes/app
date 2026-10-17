<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import BroadcastIcon from 'phosphor-svelte/lib/BroadcastIcon';
	import { formatRelative } from '../format/date';
	import { useHost } from '../host/host.context';
	import TeamPlayerList from '../match/team-player-list.svelte';
	import type { TeamSkillPlayer } from '../match/team-player-skills.svelte';
	import { displayMapName } from '../replay/links';
	import LiveBadge from '../ui/badge/live-badge.svelte';
	import MapImage from '../ui/map-image.svelte';
	import { liveLobbyPlayerHref, liveLobbyPlayerLabel } from './links';
	import { hasLiveLobbyStats } from './stats';
	import { teamPlayers, type LiveLobby } from './types';

	type Props = {
		lobby: LiveLobby;
		meSteamIds?: string[];
		class?: string;
	};

	const { t } = useI18n();
	const host = useHost();

	let { lobby, meSteamIds = [], class: className }: Props = $props();

	const mapName = $derived(displayMapName(lobby.map, host));
	const detailHref = $derived(lobby.lobbyId ? host.routes.match(lobby.lobbyId) : null);
	const startedAt = $derived(new Date(lobby.createdAt).getTime() / 1000);
	const when = $derived(Number.isFinite(startedAt) ? formatRelative(startedAt, host.locale()) : '');
	const showRanks = $derived(lobby.isRanked && hasLiveLobbyStats(lobby.players));

	function players(side: 'allies' | 'axis'): TeamSkillPlayer[] {
		return teamPlayers(lobby.players, side).map((player) => ({
			race: player.race,
			alias: liveLobbyPlayerLabel(player, t),
			steamId: player.steamId,
			profileId: player.profileId,
			stats: player.stats,
			country: player.country ?? null,
			likeCount: player.likeCount,
			href: liveLobbyPlayerHref(player, host.routes)
		}));
	}

	const chip =
		'inline-flex h-6 items-center gap-1 rounded bg-gray-950/80 px-2 text-xs font-semibold text-white backdrop-blur-sm';
</script>

{#snippet team(side: 'allies' | 'axis')}
	<div class="flex min-w-0 flex-col py-2">
		<div
			class="text-secondary-500 flex h-5 items-center px-3 text-[10px] font-semibold tracking-wider uppercase"
		>
			{side === 'allies' ? t('Allies') : t('Axis')}
		</div>
		<TeamPlayerList
			players={players(side)}
			{meSteamIds}
			showRankBadges={showRanks}
			itemClass="h-7 gap-2 px-3"
			iconClass="!size-4 ring-0"
		/>
	</div>
{/snippet}

{#snippet art()}
	<MapImage
		map={lobby.map}
		resolveMapSrc={host.resolve.mapSrc}
		resolveFallbackSrc={host.resolve.mapFallbackSrc}
		alt={mapName}
		flush
		class="absolute inset-0 aspect-auto size-full opacity-60 transition duration-500 group-hover/card:scale-[1.04] group-hover/card:opacity-85 motion-reduce:transition-none"
	/>
	<div
		class="pointer-events-none absolute inset-0 z-20 bg-linear-to-t from-gray-950 via-gray-950/50 to-gray-950/10"
	></div>
	<div class="absolute inset-x-3 top-3 z-30 flex min-w-0 flex-wrap items-center gap-1.5">
		<LiveBadge label={t('Live')} />
		{#if lobby.modeLabel}
			<span class={chip}>{lobby.modeLabel}</span>
		{/if}
	</div>
	<h3
		class="font-heading group-hover/card:text-primary absolute inset-x-4 bottom-3 z-30 truncate text-sm font-bold text-white transition-colors"
	>
		{mapName}
	</h3>
{/snippet}

<!-- Mirrors ReplayCard, for a match being played right now: no result, counters or download. -->
<article
	class={cn(
		'group/card relative flex h-full min-w-0 flex-col bg-gray-950 transition-colors duration-200',
		'hover:bg-secondary-950/50',
		className
	)}
>
	{#if detailHref}
		<a href={detailHref} class={cn(interactive, 'relative block aspect-video overflow-hidden')}>
			{@render art()}
		</a>
	{:else}
		<div class="relative aspect-video overflow-hidden">{@render art()}</div>
	{/if}

	<div class="mt-3 flex h-6 min-w-0 items-center gap-2 px-4 text-sm">
		<BroadcastIcon class="text-secondary-400 size-5 shrink-0" weight="duotone" />
		<span class="text-secondary-300 min-w-0 truncate">
			{t('Hosted by')} <span class="font-medium text-white">{lobby.hostName || t('Unknown')}</span>
		</span>
		{#if when}
			<span class="text-secondary-500 shrink-0">· {when}</span>
		{/if}
	</div>

	<!-- Teams side by side, like the replay cards. -->
	<div
		class="border-secondary-800 divide-secondary-800 mt-3 grid flex-1 grid-cols-2 divide-x border-t"
	>
		{@render team('allies')}
		{@render team('axis')}
	</div>
</article>
