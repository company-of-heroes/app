import type { RelicStats } from './relic';

export type SuspectFacts = {
	steamId: string;
	alias: string | null;
	avatarhash: string | null;
	timecreated: number | null;
	bestRank: number | null;
};

export type CandidateFacts = {
	steamId: string;
	fromFriendList: boolean;
	friendSince: number | null;
	sharedTeammates: number;
	lobbiesWithSuspect: number;
	alias: string | null;
	avatarhash: string | null;
	timecreated: number | null;
	relic: RelicStats | null;
};

export type RankedCandidate = {
	steamId: string;
	confidence: number;
	alias: string | null;
	signals: { id: string; points: number }[];
};

export const MAIN_CONFIDENCE_THRESHOLD = 55;

function normalizeAlias(alias: string): string {
	return alias.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

	for (let i = 0; i < a.length; i++) {
		const current = [i + 1];

		for (let j = 0; j < b.length; j++) {
			const substitution = previous[j] + (a[i] === b[j] ? 0 : 1);
			current.push(Math.min(substitution, previous[j + 1] + 1, current[j] + 1));
		}

		previous = current;
	}

	return previous[b.length];
}

export function aliasSimilarity(a: string | null | undefined, b: string | null | undefined): number {
	if (!a || !b) {
		return 0;
	}

	const left = normalizeAlias(a);
	const right = normalizeAlias(b);

	if (left.length < 3 || right.length < 3) {
		return 0;
	}

	if (left === right) {
		return 1;
	}

	if (left.includes(right) || right.includes(left)) {
		return 0.85;
	}

	const distance = levenshtein(left, right);
	const maxLength = Math.max(left.length, right.length);

	return Math.max(0, 1 - distance / maxLength);
}

export function rankMainCandidates(
	suspect: SuspectFacts,
	candidates: CandidateFacts[]
): RankedCandidate[] {
	const ranked: RankedCandidate[] = [];

	for (const candidate of candidates) {
		if (candidate.steamId === suspect.steamId) {
			continue;
		}

		const signals: { id: string; points: number }[] = [];

		if (suspect.avatarhash && candidate.avatarhash && suspect.avatarhash === candidate.avatarhash) {
			signals.push({ id: 'avatar_match', points: 35 });
		}

		const similarity = aliasSimilarity(suspect.alias, candidate.alias);
		if (similarity >= 0.8) {
			signals.push({ id: 'alias_similar', points: 25 });
		} else if (similarity >= 0.5) {
			signals.push({ id: 'alias_similar', points: 15 });
		}

		if (candidate.fromFriendList) {
			signals.push({ id: 'friend', points: 20 });
		}

		if (candidate.sharedTeammates >= 2) {
			signals.push({ id: 'shared_teammates', points: Math.min(15, candidate.sharedTeammates * 5) });
		}

		if (suspect.timecreated && candidate.timecreated) {
			if (candidate.timecreated < suspect.timecreated) {
				signals.push({ id: 'older_account', points: 10 });
			} else {
				// A main account is always older than its smurf.
				signals.push({ id: 'younger_account', points: -25 });
			}
		}

		if (candidate.relic && candidate.relic.totalGames > 0) {
			signals.push({ id: 'plays_coh', points: 10 });
		}

		if (
			suspect.bestRank != null &&
			candidate.relic?.bestRank != null &&
			candidate.relic.bestRank > 0
		) {
			const ratio =
				Math.max(suspect.bestRank, candidate.relic.bestRank) /
				Math.max(1, Math.min(suspect.bestRank, candidate.relic.bestRank));

			if (ratio <= 3) {
				signals.push({ id: 'rank_proximity', points: 10 });
			}
		}

		if (candidate.lobbiesWithSuspect > 1) {
			// Mains and smurfs cannot be in the same lobby; frequent co-play means "friend".
			signals.push({ id: 'plays_with_suspect', points: -30 });
		}

		const confidence = Math.max(
			0,
			Math.min(
				100,
				signals.reduce((total, signal) => total + signal.points, 0)
			)
		);

		if (confidence > 0) {
			ranked.push({
				steamId: candidate.steamId,
				confidence,
				alias: candidate.alias,
				signals
			});
		}
	}

	return ranked.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}
