import type { TournamentMatch, TournamentSlot, TournamentSlotRef } from './types';

/**
 * Swaps the players in two slots (also within one match). Statuses stay: every match keeps
 * as many players as it had. A bye that sent a player to one of the slots follows them.
 * Returns the changed matches.
 */
export function swapSlots(
	matches: TournamentMatch[],
	a: TournamentSlotRef,
	b: TournamentSlotRef
): TournamentMatch[] {
	const byId = new Map(matches.map((match) => [match.id, { ...match, games: [...match.games] }]));
	const first = byId.get(a.match);
	const second = byId.get(b.match);
	if (!first || !second || (a.match === b.match && a.slot === b.slot)) {
		return [];
	}

	const playerA = a.slot === 'A' ? first.playerA : first.playerB;
	const playerB = b.slot === 'A' ? second.playerA : second.playerB;
	const put = (match: TournamentMatch, slot: TournamentSlot, player: string | null) => {
		if (slot === 'A') {
			match.playerA = player;
		} else {
			match.playerB = player;
		}
	};
	put(first, a.slot, playerB);
	put(second, b.slot, playerA);
	const changed = new Map([first, second].map((match) => [match.id, match]));
	// A player who got here through a bye takes their bye along: it now shows the new player.
	for (const [match, slot, before, after] of [
		[first, a.slot, playerA, playerB],
		[second, b.slot, playerB, playerA]
	] as const) {
		const bye = [...byId.values()].find(
			(m) =>
				m.bye &&
				m.status === 'completed' &&
				m.nextMatch === match.id &&
				m.nextSlot === slot &&
				m.winner === before
		);
		if (bye) {
			put(bye, bye.playerA === before ? 'A' : 'B', after);
			bye.winner = after;
			changed.set(bye.id, bye);
		}
	}

	return [...changed.values()];
}
