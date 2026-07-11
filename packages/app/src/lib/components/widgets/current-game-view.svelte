<script lang="ts">
	import type { Match } from '$core/game/lobby';
	import * as List from '$lib/components/ui/list';
	import * as Player from '$lib/components/player';
	import { H } from '$lib/components/ui/h';
	import MapImage from '$lib/components/ui/map-image.svelte';
	import { cn, normalizeMapName } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import LobbyPlayersCards from './lobby-players-cards.svelte';
	import { getAlliesPlayers, getAxisPlayers, getPlayerAlias } from './dashboard-utils';

	type Props = {
		lobby: Match;
	};

	let { lobby }: Props = $props();

	const allies = $derived(getAlliesPlayers(lobby.players));
	const axis = $derived(getAxisPlayers(lobby.players));
	const startedAt = $derived(lobby.startedAt?.split(':').slice(0, 2).join(':') ?? '—');
	const humanPlayers = $derived(lobby.players.filter((player) => player.playerId !== -1).length);
</script>

<div class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(200px,300px)_minmax(0,1fr)] lg:gap-10">
	<div class="lg:sticky lg:top-6 lg:self-start">
		<MapImage map={lobby.map} alt={normalizeMapName(lobby.map)} />
	</div>

	<div class="min-w-0 py-1">
		<H level="1" class="mb-6">{normalizeMapName(lobby.map)}</H>

		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
			<List.Root>
				<List.Title>Session</List.Title>
				<List.Value class="tabular-nums">{lobby.sessionId}</List.Value>
				<List.Title>Game mode</List.Title>
				<List.Value>{lobby.type}</List.Value>
				<List.Title>Started</List.Title>
				<List.Value class="tabular-nums">{startedAt}</List.Value>
			</List.Root>
			<List.Root>
				<List.Title>Match type</List.Title>
				<List.Value>{lobby.isRanked ? 'Ranked' : 'Custom'}</List.Value>
				<List.Title>Players</List.Title>
				<List.Value>{humanPlayers} / {lobby.players.length}</List.Value>
				<List.Title>Teams</List.Title>
				<List.Value>{allies.length} vs {axis.length}</List.Value>
			</List.Root>
		</div>

		<div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
			<div>
				<p class="text-secondary-400 mb-3 text-xs font-semibold tracking-wide uppercase">Allies</p>
				<div class="flex flex-wrap items-center gap-2">
					{#each allies as player (player.index)}
						{@const stats = getLeaderboardStatsForPlayerByMatchType(lobby.matchType, player)}
						<Player.Root {player} {stats} race={player.race}>
							<span {@attach tooltip(getPlayerAlias(player))}>
								<Player.Faction
									class={cn(player.playerId === lobby.me?.playerId && 'ring-primary')}
								/>
							</span>
						</Player.Root>
					{/each}
				</div>
			</div>
			<div>
				<p class="text-secondary-400 mb-3 text-xs font-semibold tracking-wide uppercase">Axis</p>
				<div class="flex flex-wrap items-center gap-2">
					{#each axis as player (player.index)}
						{@const stats = getLeaderboardStatsForPlayerByMatchType(lobby.matchType, player)}
						<Player.Root {player} {stats} race={player.race}>
							<span {@attach tooltip(getPlayerAlias(player))}>
								<Player.Faction
									class={cn(player.playerId === lobby.me?.playerId && 'ring-primary')}
								/>
							</span>
						</Player.Root>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

<H level="2" class="mt-10 mb-4">Players</H>
<LobbyPlayersCards
	players={lobby.players}
	matchType={lobby.matchType}
	highlightPlayerId={lobby.me?.playerId}
/>
