import {
	type Env,
	type PlayerPresence,
	type SmurfWatchRecord,
	type PlayerBans,
	assertSteamAvailable,
	fetchWorkerBatch,
	getCohStatsLender,
	getFriendList,
	getLenderSteamId,
	getOwnedCoH,
	getPlayerBans,
	getPlayerSummaries,
	isoAfterSeconds,
	isoNow,
	isPlayingCoH,
	isProfilePrivate,
	MAX_STEAM_CALLS_PER_RUN,
	nextBackoffSeconds,
	patchSmurfWatch,
	pbRequest,
	RateLimitError,
	SteamCallBudget
} from './lib';
import { log, logError } from './logger';
import { getRelicStats, type RelicStats } from './relic';
import { computeSmurfScore, type ScoreResult } from './score';
import {
	type CandidateFacts,
	MAIN_CONFIDENCE_THRESHOLD,
	rankMainCandidates
} from './main-account';
import { getSteamBlockedSeconds, releaseWorkerLock, tryAcquireWorkerLock } from './steam-rate';

type ScreeningOutcome =
	| 'resolved_cohstats'
	| 'resolved_live'
	| 'not_smurf'
	| 'rescore_scheduled'
	| 'watching'
	| 'unknown_private'
	| 'deferred_cohstats'
	| 'rate_limited'
	| 'error';

type PollingOutcome =
	| 'resolved_live'
	| 'playing_no_lender'
	| 'skipped_offline'
	| 'expired'
	| 'rate_limited'
	| 'error';

const RESCORE_INTERVAL_SEC = 7 * 24 * 60 * 60;
const PRIVATE_RECHECK_SEC = 7 * 24 * 60 * 60;
const WATCHING_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const MAIN_ANALYSES_PER_RUN = 3;
const MAIN_CANDIDATE_LIMIT = 100;

type ScreeningContext = {
	summaries: Map<string, PlayerPresence>;
	bans: Map<string, PlayerBans>;
	relic: Map<string, RelicStats>;
	budget: SteamCallBudget;
	mainAnalysesLeft: number;
};

type CoplayResponse = {
	profile_id: number;
	teammates: { profile_id: number; steam_id: string | null; alias: string | null; shared_lobbies: number }[];
	candidates: { profile_id: number; steam_id: string | null; alias: string | null; shared_teammates: number }[];
};

async function patchBackoff(
	env: Env,
	record: SmurfWatchRecord,
	phase: 'screening' | 'polling',
	outcome: ScreeningOutcome | PollingOutcome
): Promise<void> {
	const interval = nextBackoffSeconds(record.check_interval_sec || 300);
	const now = isoNow();

	await patchSmurfWatch(
		env,
		record.id,
		{
			last_checked_at: now,
			next_check_at: isoAfterSeconds(interval),
			check_interval_sec: interval
		},
		{ phase, outcome }
	);
}

function buildScoreFields(
	summary: PlayerPresence | undefined,
	bans: PlayerBans | undefined,
	relic: RelicStats | undefined,
	playtimeMinutes: number | null,
	score: ScoreResult
): Record<string, unknown> {
	return {
		account_created_at: summary?.timecreated
			? new Date(summary.timecreated * 1000).toISOString()
			: null,
		coh_playtime_min: playtimeMinutes,
		game_bans: bans?.gameBans ?? null,
		vac_banned: bans?.vacBanned ?? false,
		relic_total_games: relic?.totalGames ?? null,
		relic_winrate: relic?.winrate ?? null,
		relic_level: relic?.level ?? null,
		signals: score.signals,
		smurf_score: score.score,
		verdict: score.verdict,
		score_computed_at: isoNow()
	};
}

async function analyzeMainAccount(
	env: Env,
	record: SmurfWatchRecord,
	summary: PlayerPresence | undefined,
	relic: RelicStats | undefined,
	ctx: ScreeningContext
): Promise<Record<string, unknown> | null> {
	const startedAt = Date.now();

	const friends = ctx.budget.canSpend() ? await getFriendList(env, record.steam_id, ctx.budget) : null;

	let coplay: CoplayResponse | null = null;
	if (record.profile_id) {
		try {
			coplay = await pbRequest<CoplayResponse>(
				env,
				`/api/smurf-watch/worker/coplay/${record.profile_id}`
			);
		} catch (error) {
			logError('coplay lookup failed', error, { id: record.id, profileId: record.profile_id });
		}
	}

	const facts = new Map<string, CandidateFacts>();

	const ensureCandidate = (steamId: string): CandidateFacts => {
		let candidate = facts.get(steamId);
		if (!candidate) {
			candidate = {
				steamId,
				fromFriendList: false,
				friendSince: null,
				sharedTeammates: 0,
				lobbiesWithSuspect: 0,
				alias: null,
				avatarhash: null,
				timecreated: null,
				relic: null
			};
			facts.set(steamId, candidate);
		}
		return candidate;
	};

	// Oldest friendships first: a smurf's main is usually among the first friends added.
	const sortedFriends = [...(friends ?? [])].sort((a, b) => a.friendSince - b.friendSince);
	for (const friend of sortedFriends.slice(0, 60)) {
		const candidate = ensureCandidate(friend.steamId);
		candidate.fromFriendList = true;
		candidate.friendSince = friend.friendSince || null;
	}

	for (const entry of coplay?.candidates ?? []) {
		if (!entry.steam_id) {
			continue;
		}
		const candidate = ensureCandidate(entry.steam_id);
		candidate.sharedTeammates = entry.shared_teammates;
		candidate.alias = candidate.alias ?? entry.alias;
	}

	for (const entry of coplay?.teammates ?? []) {
		if (!entry.steam_id) {
			continue;
		}
		const candidate = ensureCandidate(entry.steam_id);
		candidate.lobbiesWithSuspect = entry.shared_lobbies;
		candidate.alias = candidate.alias ?? entry.alias;
	}

	facts.delete(record.steam_id);

	if (facts.size === 0) {
		log('info', 'main account analysis: no candidates', {
			id: record.id,
			steamId: record.steam_id,
			friendListAvailable: friends !== null,
			coplayAvailable: coplay !== null
		});
		return { main_candidates: [], suspected_main_steam_id: '', main_confidence: 0 };
	}

	const candidateIds = [...facts.keys()].slice(0, MAIN_CANDIDATE_LIMIT);

	let candidateSummaries = new Map<string, PlayerPresence>();
	if (ctx.budget.canSpend()) {
		candidateSummaries = await getPlayerSummaries(env, candidateIds, ctx.budget);
	}

	const candidateRelic = await getRelicStats(candidateIds);

	for (const steamId of candidateIds) {
		const candidate = facts.get(steamId)!;
		const candidateSummary = candidateSummaries.get(steamId);
		const relicStats = candidateRelic.get(steamId);

		candidate.avatarhash = candidateSummary?.avatarhash ?? null;
		candidate.timecreated = candidateSummary?.timecreated ?? null;
		candidate.alias = candidate.alias ?? relicStats?.alias ?? candidateSummary?.personaname ?? null;
		candidate.relic = relicStats ?? null;
	}

	const ranked = rankMainCandidates(
		{
			steamId: record.steam_id,
			alias: relic?.alias ?? summary?.personaname ?? null,
			avatarhash: summary?.avatarhash ?? null,
			timecreated: summary?.timecreated ?? null,
			bestRank: relic?.bestRank ?? null
		},
		candidateIds.map((steamId) => facts.get(steamId)!)
	);

	const top = ranked[0];
	const suspectedMain = top && top.confidence >= MAIN_CONFIDENCE_THRESHOLD ? top : null;

	log('info', 'main account analysis', {
		id: record.id,
		steamId: record.steam_id,
		candidateCount: candidateIds.length,
		rankedCount: ranked.length,
		topSteamId: top?.steamId,
		topConfidence: top?.confidence,
		suspectedMain: suspectedMain?.steamId ?? null,
		durationMs: Date.now() - startedAt
	});

	return {
		main_candidates: ranked,
		suspected_main_steam_id: suspectedMain?.steamId ?? '',
		main_confidence: suspectedMain?.confidence ?? 0
	};
}

async function screenRecord(
	env: Env,
	record: SmurfWatchRecord,
	ctx: ScreeningContext
): Promise<ScreeningOutcome> {
	const startedAt = Date.now();
	const now = isoNow();
	const apiCalls: string[] = [];
	const summary = ctx.summaries.get(record.steam_id);
	const bans = ctx.bans.get(record.steam_id);
	const relic = ctx.relic.get(record.steam_id);

	log('debug', 'screening record', {
		id: record.id,
		steamId: record.steam_id,
		source: record.source,
		status: record.status,
		priority: record.priority,
		ownsCoH: record.owns_coh,
		playingCoH: isPlayingCoH(summary),
		profilePrivate: isProfilePrivate(summary),
		hasRelic: relic !== undefined
	});

	apiCalls.push('cohstats');
	const cohStats = await getCohStatsLender(record.steam_id);

	if (cohStats.ok && cohStats.lender) {
		const score = computeSmurfScore({
			lenderSteamId: cohStats.lender,
			ownsCoH: false,
			profilePrivate: isProfilePrivate(summary),
			accountCreatedAt: summary?.timecreated ?? null,
			cohPlaytimeMinutes: null,
			vacBanned: bans?.vacBanned ?? false,
			gameBans: bans?.gameBans ?? 0,
			relic: relic ?? null
		});

		await patchSmurfWatch(
			env,
			record.id,
			{
				status: 'resolved',
				owns_coh: false,
				lender_steam_id: cohStats.lender,
				lender_source: 'cohstats',
				last_checked_at: now,
				next_check_at: null,
				...buildScoreFields(summary, bans, relic, null, score)
			},
			{ phase: 'screening', outcome: 'resolved_cohstats' }
		);
		logScreeningResult(record, 'resolved_cohstats', apiCalls, startedAt, {
			lenderSteamId: cohStats.lender
		});
		return 'resolved_cohstats';
	}

	if (isPlayingCoH(summary)) {
		apiCalls.push('IsPlayingSharedGame');
		const lender = await getLenderSteamId(env, record.steam_id, ctx.budget);

		if (lender) {
			const score = computeSmurfScore({
				lenderSteamId: lender,
				ownsCoH: false,
				profilePrivate: isProfilePrivate(summary),
				accountCreatedAt: summary?.timecreated ?? null,
				cohPlaytimeMinutes: null,
				vacBanned: bans?.vacBanned ?? false,
				gameBans: bans?.gameBans ?? 0,
				relic: relic ?? null
			});

			await patchSmurfWatch(
				env,
				record.id,
				{
					status: 'resolved',
					owns_coh: false,
					lender_steam_id: lender,
					lender_source: 'live',
					last_checked_at: now,
					next_check_at: null,
					...buildScoreFields(summary, bans, relic, null, score)
				},
				{ phase: 'screening', outcome: 'resolved_live' }
			);
			logScreeningResult(record, 'resolved_live', apiCalls, startedAt, { lenderSteamId: lender });
			return 'resolved_live';
		}
	}

	let owns: boolean | null = record.owns_coh ?? null;
	let playtimeMinutes: number | null = null;

	// Refresh ownership (and playtime) unless a cached "false" makes it pointless.
	if (record.owns_coh !== false) {
		apiCalls.push('GetOwnedGames');
		const owned = await getOwnedCoH(env, record.steam_id, ctx.budget);

		if (owned.owns !== null) {
			owns = owned.owns;
			playtimeMinutes = owned.playtimeMinutes;
		} else if (record.owns_coh !== true) {
			owns = null;
		}
	}

	const profilePrivate = isProfilePrivate(summary) || (owns === null && summary === undefined);
	const score = computeSmurfScore({
		lenderSteamId: null,
		ownsCoH: owns,
		profilePrivate,
		accountCreatedAt: summary?.timecreated ?? null,
		cohPlaytimeMinutes: playtimeMinutes,
		vacBanned: bans?.vacBanned ?? false,
		gameBans: bans?.gameBans ?? 0,
		relic: relic ?? null
	});
	const scoreFields = buildScoreFields(summary, bans, relic, playtimeMinutes, score);

	if (owns === true) {
		let mainFields: Record<string, unknown> | null = null;

		if (
			(score.verdict === 'likely_smurf' || score.verdict === 'suspicious') &&
			ctx.mainAnalysesLeft > 0
		) {
			ctx.mainAnalysesLeft--;
			apiCalls.push('mainAccountAnalysis');
			mainFields = await analyzeMainAccount(env, record, summary, relic, ctx);
		}

		if (!cohStats.ok && score.verdict === 'clean') {
			// Don't make a terminal call while the cohstats check is failing; retry later.
			const interval = nextBackoffSeconds(record.check_interval_sec || 300);
			await patchSmurfWatch(
				env,
				record.id,
				{
					status: 'pending_screening',
					owns_coh: true,
					last_checked_at: now,
					next_check_at: isoAfterSeconds(interval),
					check_interval_sec: interval,
					...scoreFields,
					...(mainFields ?? {})
				},
				{ phase: 'screening', outcome: 'deferred_cohstats' }
			);
			logScreeningResult(record, 'deferred_cohstats', apiCalls, startedAt, {
				verdict: score.verdict
			});
			return 'deferred_cohstats';
		}

		if (score.verdict === 'likely_smurf' || score.verdict === 'suspicious') {
			await patchSmurfWatch(
				env,
				record.id,
				{
					status: 'pending_screening',
					owns_coh: true,
					last_checked_at: now,
					next_check_at: isoAfterSeconds(RESCORE_INTERVAL_SEC),
					check_interval_sec: 300,
					...scoreFields,
					...(mainFields ?? {})
				},
				{ phase: 'screening', outcome: 'rescore_scheduled' }
			);
			logScreeningResult(record, 'rescore_scheduled', apiCalls, startedAt, {
				verdict: score.verdict,
				smurfScore: score.score
			});
			return 'rescore_scheduled';
		}

		await patchSmurfWatch(
			env,
			record.id,
			{
				status: 'not_smurf',
				owns_coh: true,
				last_checked_at: now,
				next_check_at: null,
				...scoreFields,
				...(mainFields ?? {})
			},
			{ phase: 'screening', outcome: 'not_smurf' }
		);
		logScreeningResult(record, 'not_smurf', apiCalls, startedAt, {
			verdict: score.verdict,
			smurfScore: score.score
		});
		return 'not_smurf';
	}

	if (owns === false) {
		await patchSmurfWatch(
			env,
			record.id,
			{
				status: 'watching',
				owns_coh: false,
				last_checked_at: now,
				next_check_at: now,
				check_interval_sec: 300,
				watching_since: record.watching_since || now,
				...scoreFields
			},
			{ phase: 'screening', outcome: 'watching' }
		);
		logScreeningResult(record, 'watching', apiCalls, startedAt, {
			verdict: score.verdict,
			smurfScore: score.score
		});
		return 'watching';
	}

	await patchSmurfWatch(
		env,
		record.id,
		{
			status: 'unknown_private',
			owns_coh: null,
			last_checked_at: now,
			next_check_at: isoAfterSeconds(PRIVATE_RECHECK_SEC),
			check_interval_sec: 300,
			...scoreFields
		},
		{ phase: 'screening', outcome: 'unknown_private' }
	);
	logScreeningResult(record, 'unknown_private', apiCalls, startedAt, {
		verdict: score.verdict,
		profilePrivate
	});
	return 'unknown_private';
}

function logScreeningResult(
	record: SmurfWatchRecord,
	outcome: ScreeningOutcome,
	apiCalls: string[],
	startedAt: number,
	extra?: Record<string, unknown>
): void {
	log('info', 'screening result', {
		id: record.id,
		steamId: record.steam_id,
		source: record.source,
		outcome,
		apiCalls,
		durationMs: Date.now() - startedAt,
		...extra
	});
}

async function screenRecords(
	env: Env,
	records: SmurfWatchRecord[],
	budget: SteamCallBudget
): Promise<void> {
	if (records.length === 0) {
		log('debug', 'screening skipped: no records');
		return;
	}

	const outcomes: Record<string, number> = {};
	let processed = 0;
	let rateLimitedAt: string | null = null;

	log('info', 'screening started', {
		recordCount: records.length,
		steamBudget: budget.remaining
	});

	const steamIds = records.map((record) => record.steam_id);
	const ctx: ScreeningContext = {
		summaries: new Map(),
		bans: new Map(),
		relic: new Map(),
		budget,
		mainAnalysesLeft: MAIN_ANALYSES_PER_RUN
	};

	if (budget.canSpend()) {
		try {
			await assertSteamAvailable(env);
			ctx.summaries = await getPlayerSummaries(env, steamIds, budget);
			ctx.bans = await getPlayerBans(env, steamIds, budget);
		} catch (error) {
			if (!(error instanceof RateLimitError)) {
				throw error;
			}
			log('warn', 'steam rate limit before screening summaries', {
				retryAfterSec: error.retryAfterSec
			});
		}
	}

	ctx.relic = await getRelicStats(steamIds);

	for (const record of records) {
		try {
			const outcome = await screenRecord(env, record, ctx);
			outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
			processed++;
		} catch (error) {
			if (error instanceof RateLimitError) {
				outcomes.rate_limited = (outcomes.rate_limited ?? 0) + 1;
				rateLimitedAt = record.id;
				await patchBackoff(env, record, 'screening', 'rate_limited');
				log('warn', 'steam rate limit during screening', {
					retryAfterSec: error.retryAfterSec,
					id: record.id,
					steamId: record.steam_id,
					processed,
					remaining: records.length - processed,
					outcomes
				});
				break;
			}

			outcomes.error = (outcomes.error ?? 0) + 1;
			logError('screening failed', error, {
				id: record.id,
				steamId: record.steam_id,
				processed,
				remaining: records.length - processed
			});
		}
	}

	log('info', 'screening finished', {
		total: records.length,
		processed,
		outcomes,
		rateLimitedAt,
		steamCallsSpent: budget.spent
	});
}

function isWatchingExpired(record: SmurfWatchRecord, now: number): boolean {
	if (!record.watching_since) {
		return false;
	}

	const since = Date.parse(record.watching_since);
	return !Number.isNaN(since) && now - since > WATCHING_EXPIRY_MS;
}

async function pollRecord(
	env: Env,
	record: SmurfWatchRecord,
	summary: PlayerPresence | undefined,
	budget: SteamCallBudget
): Promise<PollingOutcome> {
	const startedAt = Date.now();
	const now = isoNow();

	if (!isPlayingCoH(summary)) {
		if (isWatchingExpired(record, Date.now())) {
			await patchSmurfWatch(
				env,
				record.id,
				{
					status: 'expired',
					last_checked_at: now,
					next_check_at: null
				},
				{ phase: 'polling', outcome: 'expired' }
			);
			log('info', 'polling result', {
				id: record.id,
				steamId: record.steam_id,
				outcome: 'expired',
				watchingSince: record.watching_since,
				durationMs: Date.now() - startedAt
			});
			return 'expired';
		}

		const interval = nextBackoffSeconds(record.check_interval_sec || 300);
		await patchSmurfWatch(
			env,
			record.id,
			{
				last_checked_at: now,
				next_check_at: isoAfterSeconds(interval),
				check_interval_sec: interval
			},
			{ phase: 'polling', outcome: 'skipped_offline' }
		);
		log('info', 'polling result', {
			id: record.id,
			steamId: record.steam_id,
			outcome: 'skipped_offline',
			personastate: summary?.personastate,
			gameid: summary?.gameid,
			gameextrainfo: summary?.gameextrainfo,
			nextIntervalSec: interval,
			durationMs: Date.now() - startedAt
		});
		return 'skipped_offline';
	}

	const lender = await getLenderSteamId(env, record.steam_id, budget);

	if (lender) {
		await patchSmurfWatch(
			env,
			record.id,
			{
				status: 'resolved',
				lender_steam_id: lender,
				lender_source: 'live',
				last_checked_at: now,
				next_check_at: null
			},
			{ phase: 'polling', outcome: 'resolved_live' }
		);
		log('info', 'polling result', {
			id: record.id,
			steamId: record.steam_id,
			outcome: 'resolved_live',
			lenderSteamId: lender,
			durationMs: Date.now() - startedAt
		});
		return 'resolved_live';
	}

	// Playing without a lender means the ownership picture may have changed
	// (e.g. bought their own copy); send back to screening for a fresh check.
	const interval = nextBackoffSeconds(record.check_interval_sec || 300);
	await patchSmurfWatch(
		env,
		record.id,
		{
			status: 'pending_screening',
			owns_coh: null,
			last_checked_at: now,
			next_check_at: isoAfterSeconds(interval),
			check_interval_sec: interval,
			watching_since: now
		},
		{ phase: 'polling', outcome: 'playing_no_lender' }
	);
	log('info', 'polling result', {
		id: record.id,
		steamId: record.steam_id,
		outcome: 'playing_no_lender',
		nextIntervalSec: interval,
		durationMs: Date.now() - startedAt
	});
	return 'playing_no_lender';
}

async function pollRecords(
	env: Env,
	records: SmurfWatchRecord[],
	budget: SteamCallBudget
): Promise<void> {
	if (records.length === 0) {
		log('debug', 'polling skipped: no records');
		return;
	}

	const outcomes: Record<string, number> = {};
	let processed = 0;
	let rateLimitedAt: string | null = null;

	log('info', 'polling started', {
		recordCount: records.length,
		steamBudget: budget.remaining
	});

	let summaries = new Map<string, PlayerPresence>();

	try {
		await assertSteamAvailable(env);
		summaries = await getPlayerSummaries(
			env,
			records.map((record) => record.steam_id),
			budget
		);
	} catch (error) {
		if (error instanceof RateLimitError) {
			log('warn', 'steam rate limit before polling summaries', {
				retryAfterSec: error.retryAfterSec,
				pollingCount: records.length
			});
			return;
		}
		throw error;
	}

	const playingCoH = records.filter((record) => isPlayingCoH(summaries.get(record.steam_id)));

	log('info', 'polling split', {
		total: records.length,
		playingCoH: playingCoH.length,
		offline: records.length - playingCoH.length
	});

	for (const record of records) {
		try {
			const outcome = await pollRecord(env, record, summaries.get(record.steam_id), budget);
			outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
			processed++;
		} catch (error) {
			if (error instanceof RateLimitError) {
				outcomes.rate_limited = (outcomes.rate_limited ?? 0) + 1;
				rateLimitedAt = record.id;
				await patchBackoff(env, record, 'polling', 'rate_limited');
				log('warn', 'steam rate limit during polling', {
					retryAfterSec: error.retryAfterSec,
					id: record.id,
					steamId: record.steam_id,
					processed,
					remaining: records.length - processed,
					outcomes
				});
				break;
			}

			outcomes.error = (outcomes.error ?? 0) + 1;
			logError('polling failed', error, {
				id: record.id,
				steamId: record.steam_id,
				processed,
				remaining: records.length - processed
			});
		}
	}

	log('info', 'polling finished', {
		total: records.length,
		processed,
		outcomes,
		rateLimitedAt,
		steamCallsSpent: budget.spent
	});
}

export async function runSmurfWorker(env: Env): Promise<void> {
	const runStartedAt = Date.now();
	const lockResult = await tryAcquireWorkerLock(env);

	if (!lockResult.acquired) {
		log('info', 'worker run skipped', {
			reason: lockResult.reason,
			lockAgeMs: lockResult.lockAgeMs
		});
		return;
	}

	const budget = new SteamCallBudget(MAX_STEAM_CALLS_PER_RUN);
	const steamBlockedSec = await getSteamBlockedSeconds(env);

	log('info', 'worker run started', {
		lockAcquired: true,
		staleLockReleased: lockResult.staleLockReleased ?? false,
		steamBlockedSec,
		steamBudget: budget.remaining
	});

	try {
		const batch = await fetchWorkerBatch(env);

		if ((batch.total_pending ?? 0) > 500) {
			log('warn', 'screening queue backlog high', { totalPending: batch.total_pending });
		}

		const screeningStartedAt = Date.now();

		await screenRecords(env, batch.screening, budget);

		log('info', 'screening phase complete', {
			durationMs: Date.now() - screeningStartedAt,
			steamCallsSpent: budget.spent,
			steamBudgetRemaining: budget.remaining
		});

		const pollingStartedAt = Date.now();

		if (budget.canSpend()) {
			await pollRecords(env, batch.polling, budget);
		} else {
			log('warn', 'polling skipped: steam budget exhausted after screening', {
				steamCallsSpent: budget.spent
			});
		}

		log('info', 'polling phase complete', {
			durationMs: Date.now() - pollingStartedAt,
			steamCallsSpent: budget.spent,
			steamBudgetRemaining: budget.remaining
		});
	} finally {
		await releaseWorkerLock(env);
		log('info', 'worker run finished', {
			durationMs: Date.now() - runStartedAt,
			steamCallsSpent: budget.spent
		});
	}
}
