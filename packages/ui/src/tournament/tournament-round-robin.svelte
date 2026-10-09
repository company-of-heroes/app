<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderTitle,
		interactive,
		statLosses,
		statWins,
		tableHeadRow
	} from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import { playerPreviewId } from '../player/player-preview-cache';
	import TournamentMatchCard from './tournament-match-card.svelte';
	import type { TournamentMatch, TournamentParticipant, TournamentStanding } from './types';
	import { useTournament } from './context';

	type Props = {
		onEdit?: (match: TournamentMatch) => void;
	};

	let { onEdit }: Props = $props();
	const context = useTournament();
	const matches = $derived(context.matches);
	const standings = $derived(context.standings);
	const participants = $derived(context.participantsById);
	const { t } = useI18n();
	const host = useHost();

	const rounds = $derived.by(() => {
		const byRound = new Map<number, TournamentMatch[]>();
		for (const match of matches) {
			byRound.set(match.round, [...(byRound.get(match.round) ?? []), match]);
		}

		return [...byRound.entries()].sort(([a], [b]) => a - b);
	});
</script>

<div class={flushHeader}>
	<p class={flushHeaderTitle}>{t('Standings')}</p>
</div>
<div class="border-secondary-800 overflow-x-auto border-b">
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class={tableHeadRow}>
				<th class="w-12 px-4 py-2">#</th>
				<th class="px-4 py-2 text-left">{t('Player')}</th>
				<th class="w-20 px-4 py-2">{t('Played')}</th>
				<th class="w-20 px-4 py-2">{t('Wins')}</th>
				<th class="w-20 px-4 py-2">{t('Losses')}</th>
				<th class="w-24 px-4 py-2">{t('Games')}</th>
			</tr>
		</thead>
		<tbody>
			{#each standings as row, index (row.participant)}
				{@const player = participants.get(row.participant)}
				<tr class="border-secondary-800/70 h-10 border-t text-white">
					<td class="text-secondary-400 px-4 text-center font-semibold tabular-nums">
						{index + 1}
					</td>
					<td class="px-4">
						{#if player}
							<PlayerProfileLink
								href={host.routes.player(player.profileId)}
								playerId={playerPreviewId({
									steamId: player.steamId,
									profileId: player.profileId
								}) ?? String(player.profileId)}
								class={cn(interactive, 'hover:text-primary font-medium')}
							>
								{player.alias}
							</PlayerProfileLink>
						{/if}
					</td>
					<td class="text-secondary-300 px-4 text-center tabular-nums">{row.played}</td>
					<td class={cn('px-4 text-center', statWins)}>{row.wins}</td>
					<td class={cn('px-4 text-center', statLosses)}>{row.losses}</td>
					<td class="text-secondary-300 px-4 text-center tabular-nums">
						{row.gamesWon}–{row.gamesLost}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#each rounds as [round, list] (round)}
	<div class={flushHeader}>
		<p class={flushHeaderTitle}>{t('Round {round}', { round })}</p>
	</div>
	<div class="border-secondary-800 flex flex-wrap gap-3 border-b px-4 py-4">
		{#each list as match (match.id)}
			<TournamentMatchCard {match} {onEdit} />
		{/each}
	</div>
{/each}
