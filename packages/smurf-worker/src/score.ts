import type { RelicStats } from './relic';

export type Verdict = 'confirmed_shared' | 'likely_smurf' | 'suspicious' | 'clean' | 'unknown';

export type SmurfSignal = {
	id: string;
	points: number;
	detail: string;
};

export type ScoreInput = {
	lenderSteamId?: string | null;
	ownsCoH: boolean | null;
	profilePrivate: boolean;
	accountCreatedAt: number | null;
	cohPlaytimeMinutes: number | null;
	vacBanned: boolean;
	gameBans: number;
	relic: RelicStats | null;
	now?: number;
};

export type ScoreResult = {
	score: number;
	verdict: Verdict;
	signals: SmurfSignal[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HEURISTIC_SCORE_CAP = 95;
const LIKELY_THRESHOLD = 65;
const SUSPICIOUS_THRESHOLD = 35;

export function computeSmurfScore(input: ScoreInput): ScoreResult {
	if (input.lenderSteamId) {
		return {
			score: 100,
			verdict: 'confirmed_shared',
			signals: [
				{
					id: 'confirmed_lender',
					points: 100,
					detail: `Playing via family sharing, lender ${input.lenderSteamId}`
				}
			]
		};
	}

	const now = input.now ?? Date.now();
	const signals: SmurfSignal[] = [];

	if (input.accountCreatedAt) {
		const ageDays = Math.floor((now - input.accountCreatedAt * 1000) / DAY_MS);

		if (ageDays < 30) {
			signals.push({ id: 'account_age', points: 30, detail: `Steam account ${ageDays}d old` });
		} else if (ageDays < 90) {
			signals.push({ id: 'account_age', points: 22, detail: `Steam account ${ageDays}d old` });
		} else if (ageDays < 365) {
			signals.push({ id: 'account_age', points: 8, detail: `Steam account ${ageDays}d old` });
		}
	}

	const relic = input.relic;
	const winratePct =
		relic?.winrate != null ? Math.round(relic.winrate * 100) : null;

	if (
		input.cohPlaytimeMinutes != null &&
		input.cohPlaytimeMinutes < 3000 &&
		relic &&
		relic.winrate != null &&
		relic.totalGames >= 20 &&
		relic.winrate >= 0.6
	) {
		signals.push({
			id: 'low_playtime_high_winrate',
			points: 30,
			detail: `${Math.round(input.cohPlaytimeMinutes / 60)}h playtime with ${winratePct}% winrate over ${relic.totalGames} games`
		});
	}

	if (relic && relic.winrate != null && relic.totalGames >= 10 && relic.totalGames < 100 && relic.winrate >= 0.6) {
		signals.push({
			id: 'few_games_high_winrate',
			points: 18,
			detail: `${winratePct}% winrate over only ${relic.totalGames} games`
		});
	}

	if (relic && relic.winrate != null && relic.totalGames >= 15 && relic.winrate >= 0.75) {
		signals.push({
			id: 'extreme_winrate',
			points: 10,
			detail: `${winratePct}% winrate over ${relic.totalGames} games`
		});
	}

	if (input.gameBans > 0) {
		signals.push({
			id: 'game_bans',
			points: 15,
			detail: `${input.gameBans} game ban(s) on record`
		});
	}

	if (input.vacBanned) {
		signals.push({ id: 'vac_ban', points: 8, detail: 'VAC banned' });
	}

	if (input.profilePrivate) {
		signals.push({ id: 'private_profile', points: 8, detail: 'Steam profile is private' });
	}

	const hasData =
		input.accountCreatedAt != null ||
		input.cohPlaytimeMinutes != null ||
		relic != null ||
		input.vacBanned ||
		input.gameBans > 0;

	if (!hasData) {
		return { score: 0, verdict: 'unknown', signals };
	}

	const score = Math.min(
		HEURISTIC_SCORE_CAP,
		signals.reduce((total, signal) => total + signal.points, 0)
	);

	const verdict: Verdict =
		score >= LIKELY_THRESHOLD ? 'likely_smurf' : score >= SUSPICIOUS_THRESHOLD ? 'suspicious' : 'clean';

	return { score, verdict, signals };
}
