import type {
	TournamentBracket,
	TournamentFormat,
	TournamentMatch,
	TournamentSlot,
	TournamentStanding
} from '@company-of-heroes/api';

/**
 * Tournament brackets: generation, byes, advancing winners (and losers in double
 * elimination), undoing a result, round robin standings and final placements.
 * Pure: the service loads the matches, calls these and saves the changed ones.
 */

/** A match before it is stored; `next`/`loserNext` point at other specs by key. */
export type MatchSpec = {
	key: string;
	bracket: TournamentBracket;
	round: number;
	position: number;
	bestOf: number;
	playerA: string | null;
	playerB: string | null;
	status: TournamentMatch['status'];
	bye: boolean;
	next: { key: string; slot: TournamentSlot } | null;
	loserNext: { key: string; slot: TournamentSlot } | null;
};

export type BracketOptions = { bestOf: number; finalsBestOf: number | null; reset: boolean };

const key = (bracket: TournamentBracket, round: number, position: number) =>
	`${bracket}-${round}-${position}`;

/** Bracket positions of seeds 1..size, so 1 and 2 can only meet in the final (1v8, 4v5, 2v7, 3v6). */
export function seedOrder(size: number): number[] {
	let order = [1];
	while (order.length < size) {
		const next = order.length * 2;
		order = order.flatMap((seed) => [seed, next + 1 - seed]);
	}

	return order;
}

/** Smallest power of two that fits every player (at least 2). */
export function bracketSize(players: number): number {
	let size = 2;
	while (size < players) {
		size *= 2;
	}

	return size;
}

function spec(
	bracket: TournamentBracket,
	round: number,
	position: number,
	bestOf: number
): MatchSpec {
	return {
		key: key(bracket, round, position),
		bracket,
		round,
		position,
		bestOf,
		playerA: null,
		playerB: null,
		status: 'pending',
		bye: false,
		next: null,
		loserNext: null
	};
}

/** Winners bracket (= single elimination): round 1 is seeded, winners move on to round + 1. */
function winnersBracket(seeded: string[], options: BracketOptions, final: boolean): MatchSpec[][] {
	const size = bracketSize(seeded.length);
	const rounds = Math.log2(size);
	const order = seedOrder(size);
	const result: MatchSpec[][] = [];
	for (let round = 1; round <= rounds; round++) {
		const count = size / 2 ** round;
		const bestOf =
			final && round === rounds ? (options.finalsBestOf ?? options.bestOf) : options.bestOf;
		result.push(Array.from({ length: count }, (_, i) => spec('winners', round, i, bestOf)));
	}

	result[0].forEach((match, i) => {
		match.playerA = seeded[order[i * 2] - 1] ?? null;
		match.playerB = seeded[order[i * 2 + 1] - 1] ?? null;
	});
	for (let round = 0; round < rounds - 1; round++) {
		result[round].forEach((match, i) => {
			match.next = { key: result[round + 1][Math.floor(i / 2)].key, slot: i % 2 === 0 ? 'A' : 'B' };
		});
	}

	return result;
}

/**
 * Losers bracket for a winners bracket of `rounds` rounds: odd rounds pair the survivors,
 * even rounds take the losers of the next winners round (in reverse every other round,
 * so players do not meet the same opponent again right away).
 */
function losersBracket(winners: MatchSpec[][], bestOf: number): MatchSpec[][] {
	const rounds = winners.length;
	const result: MatchSpec[][] = [];
	if (rounds < 2) {
		return result;
	}

	const size = winners[0].length * 2;
	for (let round = 1; round <= 2 * (rounds - 1); round++) {
		// Rounds 2k - 1 and 2k both have size / 2^(k + 1) matches.
		const count = size / 2 ** (Math.ceil(round / 2) + 1);
		result.push(Array.from({ length: count }, (_, i) => spec('losers', round, i, bestOf)));
	}

	// Round 1: losers of winners round 1, two per match.
	winners[0].forEach((match, i) => {
		match.loserNext = { key: result[0][Math.floor(i / 2)].key, slot: i % 2 === 0 ? 'A' : 'B' };
	});
	for (let round = 1; round <= result.length; round++) {
		const matches = result[round - 1];
		const next = result[round];
		if (round % 2 === 1) {
			// Survivors meet a dropped winners-bracket loser in the next round, same index.
			matches.forEach((match, i) => {
				if (next) {
					match.next = { key: next[i].key, slot: 'A' };
				}
			});
		} else {
			// Drops from winners round k + 1 into this round.
			const k = round / 2;
			const drops = winners[k];
			drops.forEach((match, i) => {
				const target = k % 2 === 1 ? matches.length - 1 - i : i;
				match.loserNext = { key: matches[target].key, slot: 'B' };
			});
			matches.forEach((match, i) => {
				if (next) {
					match.next = { key: next[Math.floor(i / 2)].key, slot: i % 2 === 0 ? 'A' : 'B' };
				}
			});
		}
	}

	return result;
}

/**
 * Marks byes and dead matches: a slot whose source can never send a player (a bye's
 * loser, a dead match) stays empty. A match with one empty slot is a bye (its player
 * goes through), with two it is dead. `ordered` must list sources before targets.
 */
function markByes(ordered: MatchSpec[]): void {
	const byKey = new Map(ordered.map((match) => [match.key, match]));
	const empty = new Map<string, { A: boolean; B: boolean }>();
	for (const match of ordered) {
		empty.set(match.key, { A: false, B: false });
	}

	for (const match of ordered.filter((m) => m.bracket === 'winners' && m.round === 1)) {
		empty.set(match.key, { A: !match.playerA, B: !match.playerB });
	}

	for (const match of ordered) {
		const slots = empty.get(match.key)!;
		const dead = slots.A && slots.B;
		match.bye = slots.A || slots.B;
		if (dead) {
			match.status = 'completed';
		}

		const send = (target: MatchSpec['next'], isEmpty: boolean) => {
			if (target && isEmpty && byKey.has(target.key)) {
				empty.get(target.key)![target.slot] = true;
			}
		};
		send(match.next, dead);
		send(match.loserNext, match.bye);
	}
}

export function buildSingleElim(seeded: string[], options: BracketOptions): MatchSpec[] {
	const matches = winnersBracket(seeded, options, true).flat();
	markByes(matches);
	return matches;
}

export function buildDoubleElim(seeded: string[], options: BracketOptions): MatchSpec[] {
	const winners = winnersBracket(seeded, options, false);
	const losers = losersBracket(winners, options.bestOf);
	const finalsBestOf = options.finalsBestOf ?? options.bestOf;
	const grandFinal = spec('grand_final', 1, 0, finalsBestOf);
	const winnersFinal = winners[winners.length - 1][0];
	winnersFinal.next = { key: grandFinal.key, slot: 'A' };
	if (losers.length) {
		losers[losers.length - 1][0].next = { key: grandFinal.key, slot: 'B' };
	} else {
		// Two players: the loser of the only winners match gets a second chance in the final.
		winnersFinal.loserNext = { key: grandFinal.key, slot: 'B' };
	}

	const matches = [...winners.flat(), ...losers.flat(), grandFinal];
	markByes(matches);
	if (options.reset) {
		// Only played when the losers-bracket player wins the first grand final.
		matches.push(spec('grand_final', 2, 0, finalsBestOf));
	}

	return matches;
}

/** Everyone plays everyone once (circle method); an odd field gets a bye each round, which is skipped. */
export function buildRoundRobin(seeded: string[], options: BracketOptions): MatchSpec[] {
	const players: (string | null)[] = [...seeded];
	if (players.length % 2 === 1) {
		players.push(null);
	}

	const matches: MatchSpec[] = [];
	const half = players.length / 2;
	let rotation = players.slice(1);
	for (let round = 1; round < players.length; round++) {
		const line = [players[0], ...rotation];
		let position = 0;
		for (let i = 0; i < half; i++) {
			const a = line[i];
			const b = line[line.length - 1 - i];
			if (!a || !b) {
				continue;
			}

			const match = spec('round_robin', round, position++, options.bestOf);
			match.playerA = a;
			match.playerB = b;
			match.status = 'ready';
			matches.push(match);
		}

		rotation = [rotation[rotation.length - 1], ...rotation.slice(0, -1)];
	}

	return matches;
}

export function buildBracket(
	format: TournamentFormat,
	seeded: string[],
	options: BracketOptions
): MatchSpec[] {
	if (format === 'double_elim') {
		return buildDoubleElim(seeded, options);
	}

	if (format === 'round_robin') {
		return buildRoundRobin(seeded, options);
	}

	return buildSingleElim(seeded, options);
}

type Board = {
	byId: Map<string, TournamentMatch>;
	changed: Set<string>;
	now: string;
	out: Set<string>;
};

function board(matches: TournamentMatch[], now: string, out: Set<string>): Board {
	return {
		byId: new Map(matches.map((match) => [match.id, { ...match, games: [...match.games] }])),
		changed: new Set(),
		now,
		out
	};
}

const changedOf = (b: Board) => [...b.changed].map((id) => b.byId.get(id)!);

const playerIn = (match: TournamentMatch, slot: TournamentSlot) =>
	slot === 'A' ? match.playerA : match.playerB;

const other = (slot: TournamentSlot): TournamentSlot => (slot === 'A' ? 'B' : 'A');

function resetMatch(b: Board): TournamentMatch | undefined {
	return [...b.byId.values()].find((m) => m.bracket === 'grand_final' && m.round === 2);
}

function place(
	b: Board,
	target: string | null,
	slot: TournamentSlot | null,
	player: string | null
) {
	const match = target ? b.byId.get(target) : undefined;
	if (!match || !slot || !player) {
		return;
	}

	if (slot === 'A') {
		match.playerA = player;
	} else {
		match.playerB = player;
	}

	b.changed.add(match.id);
	if (match.bye) {
		complete(b, match, slot);
		return;
	}

	if (match.playerA && match.playerB) {
		match.status = 'ready';
		match.readyAt = b.now;
		forfeitIfOut(b, match);
	}
}

/** A disqualified or withdrawn player loses every match they reach. */
function forfeitIfOut(b: Board, match: TournamentMatch) {
	if (match.status !== 'ready') {
		return;
	}

	const aOut = !!match.playerA && b.out.has(match.playerA);
	const bOut = !!match.playerB && b.out.has(match.playerB);
	if (aOut || bOut) {
		complete(b, match, aOut && !bOut ? 'B' : 'A');
	}
}

function complete(b: Board, match: TournamentMatch, slot: TournamentSlot) {
	const winner = playerIn(match, slot);
	const loser = playerIn(match, other(slot));
	match.winner = winner;
	match.status = 'completed';
	b.changed.add(match.id);

	if (match.bracket === 'grand_final' && match.round === 1) {
		const reset = resetMatch(b);
		if (!reset) {
			return;
		}

		b.changed.add(reset.id);
		if (slot === 'B') {
			reset.playerA = match.playerA;
			reset.playerB = match.playerB;
			reset.status = 'ready';
			reset.readyAt = b.now;
			reset.bye = false;
			forfeitIfOut(b, reset);
		} else {
			reset.status = 'completed';
			reset.bye = true;
		}

		return;
	}

	place(b, match.nextMatch, match.nextSlot, winner);
	place(b, match.loserNextMatch, match.loserNextSlot, loser);
}

/** After the bracket is stored: passes round-1 byes through and marks ready matches. */
export function settleStart(matches: TournamentMatch[], now: string): TournamentMatch[] {
	const b = board(matches, now, new Set());
	for (const match of b.byId.values()) {
		if (match.status === 'completed') {
			continue;
		}

		if (match.bye && (match.playerA || match.playerB)) {
			complete(b, match, match.playerA ? 'A' : 'B');
		} else if (match.playerA && match.playerB && match.status === 'pending') {
			match.status = 'ready';
			match.readyAt = now;
			b.changed.add(match.id);
		} else if (match.status === 'ready' && !match.readyAt) {
			match.readyAt = now;
			b.changed.add(match.id);
		}
	}

	return changedOf(b);
}

/**
 * Finishes a match for `slot` and moves the winner (and in double elimination the loser)
 * on, passing through byes and forfeits of `out` players. Returns every changed match.
 */
export function resolveMatch(
	matches: TournamentMatch[],
	matchId: string,
	slot: TournamentSlot,
	now: string,
	out: Set<string> = new Set()
): TournamentMatch[] {
	const b = board(matches, now, out);
	const match = b.byId.get(matchId);
	if (match) {
		complete(b, match, slot);
	}

	return changedOf(b);
}

/** Every ready match with an `out` player is forfeited (after a disqualification). */
export function forfeitAll(
	matches: TournamentMatch[],
	now: string,
	out: Set<string>
): TournamentMatch[] {
	const b = board(matches, now, out);
	for (const match of b.byId.values()) {
		forfeitIfOut(b, match);
	}

	return changedOf(b);
}

/**
 * Re-opens a completed match: takes its winner and loser back out of the next matches.
 * Fails (null) when one of those already has a result or played games.
 */
export function reopenMatch(
	matches: TournamentMatch[],
	matchId: string,
	now: string
): TournamentMatch[] | null {
	const b = board(matches, now, new Set());
	const match = b.byId.get(matchId);
	if (!match) {
		return null;
	}

	if (match.status !== 'completed') {
		return [];
	}

	const targets: [string | null, TournamentSlot | null][] =
		match.bracket === 'grand_final' && match.round === 1
			? [
					[resetMatch(b)?.id ?? null, 'A'],
					[resetMatch(b)?.id ?? null, 'B']
				]
			: [
					[match.nextMatch, match.nextSlot],
					[match.loserNextMatch, match.loserNextSlot]
				];
	for (const [id, slot] of targets) {
		const target = id ? b.byId.get(id) : undefined;
		if (!target || !slot) {
			continue;
		}

		const isReset = target.bracket === 'grand_final' && target.round === 2;
		if (isReset && target.status === 'completed' && target.bye) {
			// Never played: the first grand final went to the winners-bracket player.
			target.status = 'pending';
			target.bye = false;
			b.changed.add(target.id);
			continue;
		}

		// Already decided (also a bye this player passed through) or being played.
		if (target.status === 'completed' || target.games.length > 0) {
			return null;
		}

		if (slot === 'A') {
			target.playerA = null;
		} else {
			target.playerB = null;
		}

		target.status = 'pending';
		target.readyAt = null;
		b.changed.add(target.id);
	}

	match.winner = null;
	match.status = 'ready';
	b.changed.add(match.id);
	return changedOf(b);
}

/** Round robin table: match wins, then game difference, then the result between tied players. */
export function standings(
	participants: string[],
	matches: TournamentMatch[]
): TournamentStanding[] {
	const rows = new Map<string, TournamentStanding>(
		participants.map((id) => [
			id,
			{ participant: id, played: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0 }
		])
	);
	for (const match of matches) {
		if (match.status !== 'completed' || !match.playerA || !match.playerB || !match.winner) {
			continue;
		}

		const a = rows.get(match.playerA);
		const b = rows.get(match.playerB);
		if (!a || !b) {
			continue;
		}

		a.played++;
		b.played++;
		a.gamesWon += match.winsA;
		a.gamesLost += match.winsB;
		b.gamesWon += match.winsB;
		b.gamesLost += match.winsA;
		const [winner, loser] = match.winner === match.playerA ? [a, b] : [b, a];
		winner.wins++;
		loser.losses++;
	}

	const headToHead = (x: string, y: string) => {
		const match = matches.find(
			(m) =>
				m.status === 'completed' &&
				((m.playerA === x && m.playerB === y) || (m.playerA === y && m.playerB === x))
		);
		return match?.winner === x ? -1 : match?.winner === y ? 1 : 0;
	};
	const order = new Map(participants.map((id, i) => [id, i]));
	return [...rows.values()].sort(
		(x, y) =>
			y.wins - x.wins ||
			y.gamesWon - y.gamesLost - (x.gamesWon - x.gamesLost) ||
			headToHead(x.participant, y.participant) ||
			order.get(x.participant)! - order.get(y.participant)!
	);
}

/** Every match has a result (dead and unplayed reset matches count as done). */
export function isFinished(matches: TournamentMatch[]): boolean {
	return matches.length > 0 && matches.every((match) => match.status === 'completed');
}

export function champion(
	format: TournamentFormat,
	matches: TournamentMatch[],
	table: TournamentStanding[]
): string | null {
	if (format === 'round_robin') {
		return table[0]?.participant ?? null;
	}

	const reset = matches.find((m) => m.bracket === 'grand_final' && m.round === 2 && !m.bye);
	if (reset?.winner) {
		return reset.winner;
	}

	const final =
		format === 'double_elim'
			? matches.find((m) => m.bracket === 'grand_final' && m.round === 1)
			: matches.filter((m) => m.bracket === 'winners').sort((x, y) => y.round - x.round)[0];
	return final?.winner ?? null;
}

const stage = (match: TournamentMatch) =>
	match.bracket === 'winners'
		? match.round
		: match.bracket === 'losers'
			? 100 + match.round
			: 1000 + match.round;

/**
 * Final places. Elimination: players knocked out in the same round share a place
 * (both semi-final losers are 3rd). Round robin: the standings order.
 */
export function placements(
	format: TournamentFormat,
	participants: string[],
	matches: TournamentMatch[],
	table: TournamentStanding[]
): Map<string, number> {
	if (format === 'round_robin') {
		return new Map(table.map((row, i) => [row.participant, i + 1]));
	}

	const lives = format === 'double_elim' ? 2 : 1;
	const losses = new Map<string, number>();
	const knockedOut = new Map<string, number>();
	const played = matches
		.filter((m) => m.status === 'completed' && m.winner && m.playerA && m.playerB)
		.sort((x, y) => stage(x) - stage(y));
	for (const match of played) {
		const loser = match.winner === match.playerA ? match.playerB! : match.playerA!;
		const count = (losses.get(loser) ?? 0) + 1;
		losses.set(loser, count);
		// Without a reset match the grand final ends it, also for a player on their first loss.
		if (count === lives || match.bracket === 'grand_final') {
			knockedOut.set(loser, stage(match));
		}
	}

	const winner = champion(format, matches, table);
	const stages = participants.map((id) =>
		id === winner ? Number.POSITIVE_INFINITY : (knockedOut.get(id) ?? -1)
	);
	return new Map(participants.map((id, i) => [id, 1 + stages.filter((s) => s > stages[i]).length]));
}
