<script lang="ts">
	import { SmurfAlert } from '@company-of-heroes/ui/player';
	import { toPlayerSmurf } from '$lib/player/page-data';
	import type { LobbyPlayer, MatchHistoryPlayer, TransformedMatch } from '@fknoobs/app';
	import type { MatchTypeId } from '$core/game/lobby';
	import type { SmurfAlertState } from '$lib/player/smurf';
	import * as Player from '$lib/components/player';
	import { cn } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import {
		getAlliesPlayers,
		getAxisPlayers,
		getPlayerProfileId,
		getPlayerRowKey,
		isHighlightedPlayer,
		orderLobbyPlayersByTeam
	} from './dashboard-utils';
	import { useI18n } from '$lib/i18n';

	type Props = {
		players: LobbyPlayer[];
		matchType: MatchTypeId;
		highlightPlayerId?: number;
		result?: TransformedMatch | null;
		smurfs?: Record<number, SmurfAlertState>;
		cheaters?: Set<string>;
		hideStats?: boolean;
	};

	let {
		players,
		matchType,
		highlightPlayerId,
		result = null,
		smurfs,
		cheaters,
		hideStats = false
	}: Props = $props();
	const { t } = useI18n();

	const orderedPlayers = $derived(orderLobbyPlayersByTeam(players, result));
	const allies = $derived(orderLobbyPlayersByTeam(getAlliesPlayers(orderedPlayers), result));
	const axis = $derived(orderLobbyPlayersByTeam(getAxisPlayers(orderedPlayers), result));

	const playerGrid = $derived(
		hideStats
			? 'grid grid-cols-[minmax(0,1fr)] items-center gap-2'
			: 'grid grid-cols-[minmax(0,1fr)_5.5rem_4rem_3rem_3.25rem_3.25rem_3.25rem] items-center gap-2'
	);

	function playerStats(player: LobbyPlayer) {
		if (result) {
			return getLeaderboardStatsForPlayerByMatchType(result.matchtype_id, player);
		}

		return getLeaderboardStatsForPlayerByMatchType(matchType, player);
	}

	function getPlayerResult(player: LobbyPlayer): MatchHistoryPlayer | undefined {
		if (!result) {
			return undefined;
		}

		const profileId = getPlayerProfileId(player);
		if (!profileId) {
			return undefined;
		}

		return result.players.find((entry) => entry.profile_id === profileId);
	}

	function playerOutcome(player: LobbyPlayer): number | undefined {
		return getPlayerResult(player)?.outcome;
	}

	function playerSmurf(player: LobbyPlayer): SmurfAlertState | undefined {
		const profileId = getPlayerProfileId(player);
		if (profileId == null) {
			return undefined;
		}

		return smurfs?.[profileId];
	}
</script>

{#snippet playerRow(player: LobbyPlayer, rowIndex: number)}
	{@const stats = playerStats(player)}
	{@const playerResult = getPlayerResult(player)}
	{@const outcome = playerOutcome(player)}
	{@const isMe = isHighlightedPlayer(player, highlightPlayerId)}
	{@const smurf = playerSmurf(player)}
	<Player.Root {player} {playerResult} {stats} race={playerResult?.race_id ?? player.race}>
		<div
			class={cn(
				playerGrid,
				'h-11 border-b px-4',
				'border-secondary-800 last:border-b-0',
				outcome === 1 && 'bg-success/5',
				outcome === 0 && 'bg-destructive/5'
			)}
		>
			<div class="flex min-w-0 items-center gap-2.5">
				{#if player.playerId !== -1}
					<span class="border-secondary-800 size-7 shrink-0 overflow-hidden rounded-md border">
						<Player.Avatar />
					</span>
				{/if}
				<Player.Faction class={cn('shrink-0', isMe && 'ring-primary')} />
				<Player.Country class="shrink-0" />
				<Player.Alias class="min-w-0 flex-1 truncate text-sm" />
				{#if smurf?.status === 'shared'}
					{@const shared = toPlayerSmurf(smurf)}
					{#if shared}
						<SmurfAlert smurf={shared} compact />
					{/if}
				{/if}
				{#if player.steamId && cheaters?.has(player.steamId)}
					<Player.CheaterAlert compact />
				{/if}
			</div>
			{#if !hideStats}
				<div class="flex items-center justify-center gap-2.5 tabular-nums">
					<Player.RatingChange />
					<Player.Rating
						class="text-sm font-semibold"
						matchType={result?.matchtype_id ?? matchType}
					/>
				</div>
				<div class="flex items-center justify-center gap-1">
					<Player.Rank class="h-5 w-5" />
					<Player.Level class="text-sm font-medium tabular-nums" />
				</div>
				<Player.Position class="text-center text-sm font-medium tabular-nums" />
				<Player.Wins class="text-center text-sm font-medium tabular-nums" />
				<Player.Losses class="text-center text-sm font-medium tabular-nums" />
				<Player.Streak class="text-center text-sm font-medium tabular-nums" />
			{/if}
		</div>
	</Player.Root>
{/snippet}

{#snippet teamColumn(label: string, teamPlayers: LobbyPlayer[])}
	<div class="min-w-0">
		<div
			class={cn(
				playerGrid,
				'bg-secondary-950/90 text-secondary-300 border-secondary-800 border-b px-4 py-2.5 text-xs font-semibold tracking-wide uppercase'
			)}
		>
			<span>{label}</span>
			{#if !hideStats}
				<span class="text-center">{t('ELO')}</span>
				<span class="text-center">{t('Level')}</span>
				<span class="text-center">{t('Pos')}</span>
				<span class="text-center">{t('W')}</span>
				<span class="text-center">{t('L')}</span>
				<span class="text-center">{t('Streak')}</span>
			{/if}
		</div>
		{#each teamPlayers as player, rowIndex (getPlayerRowKey(player, rowIndex))}
			{@render playerRow(player, rowIndex)}
		{/each}
	</div>
{/snippet}

<div class="divide-secondary-800 grid grid-cols-1 md:grid-cols-2 md:divide-x">
	{@render teamColumn(t('Allies'), allies)}
	{@render teamColumn(t('Axis'), axis)}
</div>
