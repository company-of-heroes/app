<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { flushHeader, flushHeaderTitle } from '@company-of-heroes/ui/variants';
	import { roundLabel } from './format';
	import TournamentMatchCard from './tournament-match-card.svelte';
	import type {
		TournamentBracket,
		TournamentFormat,
		TournamentMatch,
		TournamentParticipant
	} from './types';
	import { useTournament } from './context';

	type Props = {
		onEdit?: (match: TournamentMatch) => void;
	};

	let { onEdit }: Props = $props();
	const context = useTournament();
	const format = $derived(context.tournament.format);
	const matches = $derived(context.matches);
	const { t } = useI18n();

	type Section = { bracket: TournamentBracket; title: string | null; rounds: TournamentMatch[][] };

	function roundsOf(bracket: TournamentBracket): TournamentMatch[][] {
		const byRound = new Map<number, TournamentMatch[]>();
		for (const match of matches.filter((m) => m.bracket === bracket)) {
			byRound.set(match.round, [...(byRound.get(match.round) ?? []), match]);
		}

		return [...byRound.entries()]
			.sort(([a], [b]) => a - b)
			.map(([, list]) => list.sort((a, b) => a.position - b.position));
	}

	const sections = $derived.by((): Section[] => {
		const winners = roundsOf('winners');
		if (format !== 'double_elim') {
			return [{ bracket: 'winners', title: null, rounds: winners }];
		}

		// The reset match is hidden once it is not needed (the winners-bracket player won).
		const finals = roundsOf('grand_final').filter((round) =>
			round.some((match) => !(match.round === 2 && match.bye))
		);
		const all: Section[] = [
			{ bracket: 'winners', title: t('Winners bracket'), rounds: winners },
			{ bracket: 'losers', title: t('Losers bracket'), rounds: roundsOf('losers') },
			{ bracket: 'grand_final', title: t('Grand final'), rounds: finals }
		];
		return all.filter((section) => section.rounds.length > 0);
	});
</script>

{#each sections as section (section.bracket)}
	{#if section.title}
		<div class={flushHeader}>
			<p class={flushHeaderTitle}>{section.title}</p>
		</div>
	{/if}
	<div class="border-secondary-800 overflow-x-auto border-b">
		<div class="divide-secondary-800 flex w-max min-w-full divide-x">
			{#each section.rounds as round (round[0].id)}
				<div class="flex w-64 shrink-0 flex-col last:min-w-64 last:flex-1">
					<p
						class="border-secondary-800 text-secondary-400 border-b px-4 py-2 text-xs font-semibold tracking-wide uppercase"
					>
						{roundLabel(t, format, round[0], section.rounds.length)}
					</p>
					<div class="flex flex-1 flex-col justify-around gap-3 px-4 py-4">
						{#each round as match (match.id)}
							<TournamentMatchCard {match} {onEdit} />
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/each}
