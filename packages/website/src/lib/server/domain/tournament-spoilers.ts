import type { TournamentDetail, TournamentMatch, TournamentSlot } from '@company-of-heroes/api';
import { standings } from './tournament-bracket';

/**
 * Hidden results (`Tournament.hideResults`): what the public sees of a tournament whose host keeps
 * the results back. Pure: the service decides who gets this.
 */

const slotKey = (matchId: string, slot: TournamentSlot) => `${matchId}:${slot}`;

/**
 * The bracket as if nothing was played: no scores, winners or games, and players who reached a
 * match by winning (or losing) another one are left out. Byes follow from the seeding and stay.
 */
export function unplayed(matches: TournamentMatch[]): TournamentMatch[] {
	const feeders = new Map<string, TournamentMatch>();
	for (const match of matches) {
		if (match.nextMatch && match.nextSlot) {
			feeders.set(slotKey(match.nextMatch, match.nextSlot), match);
		}

		if (match.loserNextMatch && match.loserNextSlot) {
			feeders.set(slotKey(match.loserNextMatch, match.loserNextSlot), match);
		}
	}

	const settled = new Map<string, boolean>();
	// A bye whose player came from the seeding (or from another such bye).
	const isSettled = (match: TournamentMatch): boolean => {
		const known = settled.get(match.id);
		if (known !== undefined) {
			return known;
		}

		settled.set(match.id, false);
		const value = match.bye && (['A', 'B'] as const).every((slot) => !hidden(match.id, slot));
		settled.set(match.id, value);
		return value;
	};
	const hidden = (matchId: string, slot: TournamentSlot) => {
		const feeder = feeders.get(slotKey(matchId, slot));
		return !!feeder && !isSettled(feeder);
	};

	return matches.map((match) => {
		if (isSettled(match)) {
			return match;
		}

		const playerA = hidden(match.id, 'A') ? null : match.playerA;
		const playerB = hidden(match.id, 'B') ? null : match.playerB;
		const ready = !!playerA && !!playerB;
		return {
			...match,
			playerA,
			playerB,
			winsA: 0,
			winsB: 0,
			winner: null,
			games: [],
			manual: false,
			status: ready ? 'ready' : 'pending',
			readyAt: ready ? match.readyAt : null
		};
	});
}

/** The detail without scores, winners, placements, the champion or the "finished" post. */
export function withoutResults(detail: TournamentDetail): TournamentDetail {
	const matches = unplayed(detail.matches);
	return {
		...detail,
		tournament: { ...detail.tournament, winner: null, champion: null },
		participants: detail.participants.map((participant) => ({ ...participant, placement: null })),
		matches,
		standings: detail.standings.length
			? standings(
					detail.participants.map((participant) => participant.id),
					matches
				)
			: [],
		replays: [],
		posts: detail.posts.filter((post) => post.kind !== 'finished'),
		resultsHidden: true
	};
}
