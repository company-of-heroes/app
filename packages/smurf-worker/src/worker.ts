import {
	type Env,
	type SmurfWatchRecord,
	assertSteamAvailable,
	fetchWorkerBatch,
	getCohStatsLender,
	getLenderSteamId,
	getOwnedCoH,
	getPlayerSummaries,
	isoAfterSeconds,
	isoNow,
	nextBackoffSeconds,
	patchSmurfWatch,
	RateLimitError,
	COH_APP_ID
} from './lib';
import { log, logError } from './logger';
import { releaseWorkerLock, tryAcquireWorkerLock } from './steam-rate';

async function screenRecord(env: Env, record: SmurfWatchRecord): Promise<void> {
	log('debug', 'screening record', {
		id: record.id,
		steamId: record.steam_id,
		source: record.source,
		status: record.status,
		priority: record.priority,
		ownsCoH: record.owns_coh
	});

	const now = isoNow();

	if (record.owns_coh === true) {
		log('info', 'screening result: not smurf (cached ownership)', {
			id: record.id,
			steamId: record.steam_id
		});
		await patchSmurfWatch(env, record.id, {
			status: 'not_smurf',
			owns_coh: true,
			last_checked_at: now
		});
		return;
	}

	const cohStatsLender = await getCohStatsLender(record.steam_id);
	if (cohStatsLender) {
		log('info', 'screening result: resolved via cohstats', {
			id: record.id,
			steamId: record.steam_id,
			lenderSteamId: cohStatsLender
		});
		await patchSmurfWatch(env, record.id, {
			status: 'resolved',
			owns_coh: false,
			lender_steam_id: cohStatsLender,
			lender_source: 'cohstats',
			last_checked_at: now,
			next_check_at: null
		});
		return;
	}

	if (record.owns_coh === false) {
		log('info', 'screening result: watching (cached no ownership)', {
			id: record.id,
			steamId: record.steam_id
		});
		await patchSmurfWatch(env, record.id, {
			status: 'watching',
			owns_coh: false,
			last_checked_at: now,
			next_check_at: now,
			check_interval_sec: 300
		});
		return;
	}

	const ownsCoH = await getOwnedCoH(env, record.steam_id);

	if (ownsCoH === true) {
		log('info', 'screening result: not smurf', { id: record.id, steamId: record.steam_id });
		await patchSmurfWatch(env, record.id, {
			status: 'not_smurf',
			owns_coh: true,
			last_checked_at: now
		});
		return;
	}

	if (ownsCoH === false) {
		log('info', 'screening result: watching (no coh ownership)', {
			id: record.id,
			steamId: record.steam_id
		});
		await patchSmurfWatch(env, record.id, {
			status: 'watching',
			owns_coh: false,
			last_checked_at: now,
			next_check_at: now,
			check_interval_sec: 300
		});
		return;
	}

	log('info', 'screening result: watching (ownership unknown)', {
		id: record.id,
		steamId: record.steam_id,
		newPriority: Math.max(0, record.priority - 10)
	});
	await patchSmurfWatch(env, record.id, {
		status: 'watching',
		owns_coh: null,
		last_checked_at: now,
		next_check_at: now,
		check_interval_sec: 900,
		priority: Math.max(0, record.priority - 10)
	});
}

function isPlayingCoH(
	record: SmurfWatchRecord,
	summary: { gameid?: string; personastate: number } | undefined
): boolean {
	if (summary?.gameid === String(COH_APP_ID)) {
		return true;
	}

	if (record.source === 'lobby_live' && (summary?.personastate ?? 0) > 0) {
		return true;
	}

	return false;
}

async function pollRecords(env: Env, records: SmurfWatchRecord[]): Promise<void> {
	if (records.length === 0) {
		log('debug', 'polling skipped: no records');
		return;
	}

	log('info', 'polling started', { recordCount: records.length });

	const summaries = await getPlayerSummaries(
		env,
		records.map((record) => record.steam_id)
	);

	const playingCoH = records.filter((record) => isPlayingCoH(record, summaries.get(record.steam_id)));

	log('info', 'polling split', {
		total: records.length,
		playingCoH: playingCoH.length,
		offline: records.length - playingCoH.length
	});

	for (const record of playingCoH) {
		log('debug', 'polling live record', {
			id: record.id,
			steamId: record.steam_id,
			source: record.source
		});

		const lender = await getLenderSteamId(env, record.steam_id);
		const now = isoNow();

		if (lender) {
			log('info', 'polling result: resolved via live lender', {
				id: record.id,
				steamId: record.steam_id,
				lenderSteamId: lender
			});
			await patchSmurfWatch(env, record.id, {
				status: 'resolved',
				lender_steam_id: lender,
				lender_source: 'live',
				last_checked_at: now,
				next_check_at: null
			});
			continue;
		}

		const interval = nextBackoffSeconds(record.check_interval_sec || 300);
		log('debug', 'polling result: still playing, no lender yet', {
			id: record.id,
			steamId: record.steam_id,
			nextIntervalSec: interval
		});
		await patchSmurfWatch(env, record.id, {
			last_checked_at: now,
			next_check_at: isoAfterSeconds(interval),
			check_interval_sec: interval
		});
	}

	const playingIds = new Set(playingCoH.map((record) => record.id));
	const offline = records.filter((record) => !playingIds.has(record.id));
	for (const record of offline) {
		const interval = nextBackoffSeconds(record.check_interval_sec || 300);
		log('debug', 'polling result: offline backoff', {
			id: record.id,
			steamId: record.steam_id,
			nextIntervalSec: interval
		});
		await patchSmurfWatch(env, record.id, {
			last_checked_at: isoNow(),
			next_check_at: isoAfterSeconds(interval),
			check_interval_sec: interval
		});
	}

	log('info', 'polling finished', {
		liveProcessed: playingCoH.length,
		offlineProcessed: offline.length
	});
}

export async function runSmurfWorker(env: Env): Promise<void> {
	if (!(await tryAcquireWorkerLock(env))) {
		return;
	}

	try {
		await assertSteamAvailable(env);

		const batch = await fetchWorkerBatch(env);

		log('info', 'screening started', { recordCount: batch.screening.length });

		let screened = 0;
		for (const record of batch.screening) {
			try {
				await screenRecord(env, record);
				screened++;
			} catch (error) {
				if (error instanceof RateLimitError) {
					log('warn', 'steam rate limit during screening', {
						retryAfterSec: error.retryAfterSec,
						screened,
						remaining: batch.screening.length - screened
					});
					break;
				}
				logError('screening failed', error, {
					id: record.id,
					steamId: record.steam_id
				});
			}
		}

		log('info', 'screening finished', {
			total: batch.screening.length,
			processed: screened
		});

		try {
			await assertSteamAvailable(env);
			await pollRecords(env, batch.polling);
		} catch (error) {
			if (error instanceof RateLimitError) {
				log('warn', 'steam rate limit during polling', {
					retryAfterSec: error.retryAfterSec,
					pollingCount: batch.polling.length
				});
				return;
			}
			throw error;
		}
	} finally {
		await releaseWorkerLock(env);
	}
}
