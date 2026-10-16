<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import CountryFlag from '../player/country-flag.svelte';
	import PlayerLikeCount from '../player/player-like-count.svelte';
	import RankIcon from '../player/rank-icon.svelte';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import PlayerStreamerIcon from '../player/player-streamer-icon.svelte';
	import type { TeamSkillPlayer } from './team-player-skills.svelte';

	type Props = {
		players: TeamSkillPlayer[];
		meSteamIds?: string[];
		/** Players the list is filtered on (profile id, Steam ID or alias); shown in blue. */
		highlightedPlayers?: string[];
		/** When false, show faction flags instead of rank badges. */
		showRankBadges?: boolean;
		class?: string;
		/** Height and padding of each player line. */
		itemClass?: string;
		/** Right-aligned lines (icon on the right), for the left side of a face-off. */
		mirrored?: boolean;
	};

	const host = useHost();

	let {
		players,
		meSteamIds = [],
		highlightedPlayers = [],
		showRankBadges = true,
		class: className,
		itemClass = 'h-6',
		mirrored = false
	}: Props = $props();

	function isFiltered(player: TeamSkillPlayer) {
		if (!highlightedPlayers.length) {
			return false;
		}

		const ids = [player.profileId != null ? String(player.profileId) : '', player.steamId ?? ''];
		if (ids.some((id) => id && highlightedPlayers.includes(id))) {
			return true;
		}

		const alias = player.alias.trim().toLowerCase();
		return Boolean(alias && highlightedPlayers.some((entry) => entry.toLowerCase() === alias));
	}
</script>

<!-- One line per player: rank badge (or faction flag), name and ladder position. -->
<ul class={cn('flex min-w-0 flex-col', className)}>
	{#each players as player, index (`${player.profileId ?? player.steamId ?? ''}:${index}`)}
		{@const isMe = !!player.steamId && meSteamIds.includes(player.steamId)}
		{@const filtered = !isMe && isFiltered(player)}
		{@const ranked = showRankBadges && !!player.stats}
		{@const ranking = player.stats?.rank ?? 0}
		<li
			class={cn(
				'flex min-w-0 items-center gap-2 text-sm',
				mirrored && 'flex-row-reverse text-end',
				itemClass
			)}
		>
			{#if ranked}
				<RankIcon
					level={player.stats?.rankLevel ?? 0}
					race={player.race}
					position={player.stats?.rank}
				/>
			{:else}
				<img
					loading="lazy"
					decoding="async"
					src={host.resolve.factionFlagByRace(player.race ?? 0)}
					alt=""
					class={factionIcon}
				/>
			{/if}
			<CountryFlag country={player.country} />
			<PlayerLikeCount likeCount={player.likeCount} class="shrink-0" />
			<PlayerStreamerIcon steamId={player.steamId} />
			{#if player.href}
				<PlayerProfileLink
					href={player.href}
					class={cn(
						interactive,
						'hover:text-primary min-w-0 truncate transition-colors',
						isMe && 'text-primary font-semibold',
						filtered && 'text-info font-semibold',
						!isMe && !filtered && 'text-secondary-200'
					)}
				>
					{player.alias || '—'}
				</PlayerProfileLink>
			{:else}
				<span class="text-secondary-400 min-w-0 truncate">{player.alias || '—'}</span>
			{/if}
			{#if player.note}
				<span class="text-secondary-500 min-w-0 shrink truncate text-xs">{player.note}</span>
			{/if}
			{#if ranked}
				<span
					class={cn(
						'text-secondary-400 shrink-0 text-xs tabular-nums',
						mirrored ? 'me-auto pe-2' : 'ms-auto ps-2'
					)}
				>
					{ranking > 0 ? `#${ranking}` : '-'}
				</span>
			{/if}
		</li>
	{/each}
</ul>
