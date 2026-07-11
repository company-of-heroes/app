<script lang="ts">
	import type { LobbyPlayer, MatchHistoryPlayer, TransformedMatch } from '@fknoobs/app';
	import type { MatchTypeId } from '$core/game/lobby';
	import * as Player from '$lib/components/player';
	import { cn } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import { sortBy } from 'lodash-es';
	import { getPlayerProfileId } from './dashboard-utils';

	type Props = {
		players: LobbyPlayer[];
		matchType: MatchTypeId;
		highlightPlayerId?: number;
		result?: TransformedMatch | null;
	};

	let { players, matchType, highlightPlayerId, result = null }: Props = $props();

	const orderedPlayers = $derived(sortBy(players, ['team', 'index']));
	const playerGrid =
		'grid grid-cols-[2.5rem_3.5rem_4rem_minmax(0,1fr)_3.5rem_3.5rem_3.5rem] items-center gap-3';

	function playerStats(player: LobbyPlayer) {
		if (result) {
			return getLeaderboardStatsForPlayerByMatchType(result.matchtype_id, player);
		}
		return getLeaderboardStatsForPlayerByMatchType(matchType, player);
	}

	function getPlayerResult(player: LobbyPlayer): MatchHistoryPlayer | undefined {
		if (!result) return undefined;

		const profileId = getPlayerProfileId(player);
		if (!profileId) return undefined;

		return result.players.find((entry) => entry.profile_id === profileId);
	}

	function playerOutcome(player: LobbyPlayer): number | undefined {
		return getPlayerResult(player)?.outcome;
	}
</script>

<div>
	<div
		class={cn(
			playerGrid,
			'bg-secondary-950/90 text-secondary-300 border-secondary-800 border-b px-4 py-2 text-xs font-semibold tracking-wide uppercase'
		)}
	>
		<span class="text-center">Team</span>
		<span class="text-center">ELO</span>
		<span class="text-center">Rank</span>
		<span>Player</span>
		<span class="text-center">Wins</span>
		<span class="text-center">Losses</span>
		<span class="text-center">Streak</span>
	</div>
	{#each orderedPlayers as player (player.index)}
		{@const stats = playerStats(player)}
		{@const playerResult = getPlayerResult(player)}
		{@const isMe = highlightPlayerId !== undefined && player.playerId === highlightPlayerId}
		{@const outcome = playerOutcome(player)}
		<Player.Root {player} {playerResult} {stats} race={player.race}>
			<div
				class={cn(
					playerGrid,
					'border-secondary-800 border-b px-4 py-3 last:border-b-0',
					outcome === 1 && 'bg-success/5',
					outcome === 0 && 'bg-destructive/5',
					isMe && 'bg-primary/5'
				)}
			>
				<div class="flex justify-center">
					<Player.Faction
						class="h-auto! w-6! shrink-0 rounded-none! object-contain! ring-1! ring-black/40"
					/>
				</div>
				<Player.Rating class="text-center font-medium tabular-nums" />
				<Player.Level class="text-secondary-400 text-center text-sm tabular-nums" />
				<div class="flex min-w-0 items-center gap-3">
					{#if player.playerId !== -1}
						<span class="border-secondary-800 size-9 shrink-0 overflow-hidden rounded-lg border">
							<Player.Avatar />
						</span>
					{/if}
					<Player.Country class="shrink-0" />
					<Player.Alias
						class={cn('min-w-0 flex-1 truncate', isMe && 'text-primary font-semibold')}
					/>
				</div>
				<Player.Wins class="text-center font-medium tabular-nums" />
				<Player.Losses class="text-center font-medium tabular-nums" />
				<Player.Streak class="text-center font-medium tabular-nums" />
			</div>
		</Player.Root>
	{/each}
</div>
