<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import * as Player from '$lib/components/player';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
	import { Race } from '$lib/utils/game';
	import { isMePlayer } from '$lib/utils/player-me';
	import { intersection } from 'lodash-es';
	import { useI18n } from '$lib/i18n';
	import type { LobbyPlayer } from '@fknoobs/app';

	type Props = {
		team: 'allies' | 'axis';
		highlightedPlayers?: string[];
	} & HTMLAttributes<HTMLSpanElement>;

	let { team, highlightedPlayers = [], ...restProps }: Props = $props();
	const { t } = useI18n();
	const match = useMatch();

	function onTeam(player: LobbyPlayer, side: 'allies' | 'axis') {
		if (player.team === 0 || player.team === 1) {
			return side === 'allies' ? player.team === 0 : player.team === 1;
		}

		if (side === 'allies') {
			return player.race === Race.US || player.race === Race.Commonwealth;
		}

		return player.race === Race.Wehrmacht || player.race === Race.PanzerElite;
	}

	const players = $derived(match.players?.filter((player) => onTeam(player, team)) || []);

	function playerHref(player: LobbyPlayer) {
		if (player.playerId === -1) {
			return null;
		}

		if (player.profile?.profile_id) {
			return `/players/${player.profile.profile_id}`;
		}

		if (player.steamId) {
			return `/players/${player.steamId}`;
		}

		return null;
	}

	function isHighlighted(player: LobbyPlayer) {
		if (!highlightedPlayers.length) {
			return false;
		}

		const ids = [
			player.playerId?.toString(),
			player.profile?.profile_id?.toString(),
			player.steamId
		].filter(Boolean) as string[];

		if (intersection(highlightedPlayers, ids).length > 0) {
			return true;
		}

		const name = player.profile?.alias || player.name;
		if (!name) {
			return false;
		}

		const normalized = name.toLowerCase();
		return highlightedPlayers.some((entry) => entry.toLowerCase() === normalized);
	}
</script>

<span {...restProps} class={cn('flex items-center gap-2', restProps.class)}>
	{#each players as player (player.playerId ?? player.index)}
		{@const highlighted = isHighlighted(player)}
		{@const isMe = isMePlayer(player)}
		{@const label = player.profile?.alias || player.name || t('Unknown')}
		{@const href = playerHref(player)}
		{@const factionClass = cn(
			isMe || highlighted ? 'grayscale-0' : 'opacity-50 grayscale-80',
			isMe && 'ring-primary',
			!isMe && highlighted && 'ring-info',
			'hover:opacity-100 hover:grayscale-0'
		)}
		<Player.Root {player}>
			{#if href}
				<a {href} class="cursor-pointer">
					<Player.Faction {@attach tooltip(label)} class={factionClass} />
				</a>
			{:else}
				<Player.Faction {@attach tooltip(label)} class={factionClass} />
			{/if}
		</Player.Root>
	{/each}
</span>
