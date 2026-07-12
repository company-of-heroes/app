import {
	type Env,
	type PlayerPresence,
	type SmurfWatchRecord,
	assertSteamAvailable,
	fetchWorkerBatch,
	getCohStatsLender,
	getLenderSteamId,
	getOwnedCoH,
	getPlayerSummaries,
	isoAfterSeconds,
	isoNow,
	isPlayingCoH,
	MAX_STEAM_CALLS_PER_RUN,
	nextBackoffSeconds,
	patchSmurfWatch,
	RateLimitError,
	SteamCallBudget
} from './lib';
import { log, logError } from './logger';
import { getSteamBlockedSeconds, releaseWorkerLock, tryAcquireWorkerLock } from './steam-rate';

type ScreeningOutcome =
	| 'not_smurf_cached'
	| 'resolved_cohstats'
	| 'watching_cached'
	| 'resolved_live'
	| 'not_smurf'
	| 'watching'
	| 'watching_unknown'
	| 'rate_limited'
	| 'error';

type PollingOutcome = 'resolved_live' | 'playing_no_lender' | 'skipped_offline' | 'rate_limited' | 'error';

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

async function screenRecord(
	env: Env,
	record: SmurfWatchRecord,
	summary: PlayerPresence | undefined,
	budget: SteamCallBudget
): Promise<ScreeningOutcome> {
	const startedAt = Date.now();
	const now = isoNow();
	const apiCalls: string[] = [];

	log('debug', 'screening record', {
		id: record.id,
		steamId: record.steam_id,
		source: record.source,
		status: record.status,
		priority: record.priority,
		ownsCoH: record.owns_coh,
		playingCoH: isPlayingCoH(summary)
	});

	if (record.owns_coh === true) {
		await patchSmurfWatch(
			env,
			record.id,
			{
				status: 'not_smurf',
				owns_coh: true,
				last_checked_at: now
			},
			{ phase: 'screening', outcome: 'not_smurf_cached' }
		);
		logScreeningResult(record, 'not_smurf_cached', apiCalls, startedAt);
		return 'not_smurf_cached';
	}

	apiCalls.push('cohstats');
	const cohStatsLender = await getCohStatsLender(record.steam_id);
	if (cohStatsLender) {
		await patchSmurfWatch(
			env,
			record.id,
			{
				status: 'resolved',
				owns_coh: false,
				lender_steam_id: cohStatsLender,
				lender_source: 'cohstats',
				last_checked_at: now,
				next_check_at: null
			},
			{ phase: 'screening', outcome: 'resolved_cohstats' }
		);
		logScreeningResult(record, 'resolved_cohstats', apiCalls, startedAt, {
			lenderSteamId: cohStatsLender
		});
		return 'resolved_cohstats';
	}

	if (record.owns_coh === false) {
		await patchSmurfWatch(
			env,
			record.id,
			{
				status: 'watching',
				owns_coh: false,
				last_checked_at: now,
				next_check_at: now,
				check_interval_sec: 300
			},
			{ phase: 'screening', outcome: 'watching_cached' }
		);
		logScreeningResult(record, 'watching_cached', apiCalls, startedAt);
		return 'watching_cached';
	}

	if (isPlayingCoH(summary)) {
		apiCalls.push('IsPlayingSharedGame');
		const lender = await getLenderSteamId(env, record.steam_id, budget);
		if (lender) {
			await patchSmurfWatch(
				env,
				record.id,
				{
					status: 'resolved',
					owns_coh: false,
					lender_steam_id: lender,
					lender_source: 'live',
					last_checked_at: now,
					next_check_at: null
				},
				{ phase: 'screening', outcome: 'resolved_live' }
			);
			logScreeningResult(record, 'resolved_live', apiCalls, startedAt, { lenderSteamId: lender });
			return 'resolved_live';
		}
	}

	apiCalls.push('GetOwnedGames');
	const ownsCoH = await getOwnedCoH(env, record.steam_id, budget);

	if (ownsCoH === true) {
		await patchSmurfWatch(
			env,
			record.id,
			{
				status: 'not_smurf',
				owns_coh: true,
				last_checked_at: now
			},
			{ phase: 'screening', outcome: 'not_smurf' }
		);
		logScreeningResult(record, 'not_smurf', apiCalls, startedAt);
		return 'not_smurf';
	}

	if (ownsCoH === false) {
		await patchSmurfWatch(
			env,
			record.id,
			{
				status: 'watching',
				owns_coh: false,
				last_checked_at: now,
				next_check_at: now,
				check_interval_sec: 300
			},
			{ phase: 'screening', outcome: 'watching' }
		);
		logScreeningResult(record, 'watching', apiCalls, startedAt);
		return 'watching';
	}

	const newPriority = Math.max(0, record.priority - 10);
	await patchSmurfWatch(
		env,
		record.id,
		{
			status: 'watching',
			owns_coh: null,
			last_checked_at: now,
			next_check_at: now,
			check_interval_sec: 900,
			priority: newPriority
		},
		{ phase: 'screening', outcome: 'watching_unknown' }
	);
	logScreeningResult(record, 'watching_unknown', apiCalls, startedAt, { newPriority });
	return 'watching_unknown';
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

async function screenRecords(env: Env, records: SmurfWatchRecord[], budget: SteamCallBudget): Promise<void> {
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

	let summaries = new Map<string, PlayerPresence>();
	const needsSteam = records.filter((record) => record.owns_coh !== true);

	if (needsSteam.length > 0 && budget.canSpend()) {
		try {
			await assertSteamAvailable(env);
			summaries = await getPlayerSummaries(
				env,
				needsSteam.map((record) => record.steam_id),
				budget
			);
		} catch (error) {
			if (!(error instanceof RateLimitError)) {
				throw error;
			}
			log('warn', 'steam rate limit before screening summaries', {
				retryAfterSec: error.retryAfterSec
			});
		}
	}

	for (const record of records) {
		try {
			const outcome = await screenRecord(env, record, summaries.get(record.steam_id), budget);
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

async function pollRecord(
	env: Env,
	record: SmurfWatchRecord,
	summary: PlayerPresence | undefined,
	budget: SteamCallBudget
): Promise<PollingOutcome> {
	const startedAt = Date.now();
	const now = isoNow();

	if (!isPlayingCoH(summary)) {
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

	const interval = nextBackoffSeconds(record.check_interval_sec || 300);
	await patchSmurfWatch(
		env,
		record.id,
		{
			last_checked_at: now,
			next_check_at: isoAfterSeconds(interval),
			check_interval_sec: interval
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

async function pollRecords(env: Env, records: SmurfWatchRecord[], budget: SteamCallBudget): Promise<void> {
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
