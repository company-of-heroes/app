import {
	type Env,
	type SmurfWatchRecord,
	fetchWorkerBatch,
	getCohStatsLender,
	getLenderSteamId,
	getOwnedCoH,
	getPlayerSummaries,
	isoAfterSeconds,
	isoNow,
	nextBackoffSeconds,
	patchSmurfWatch,
	sleep,
	RateLimitError,
	COH_APP_ID
} from './lib';

async function screenRecord(env: Env, record: SmurfWatchRecord): Promise<void> {
	const ownsCoH = await getOwnedCoH(env, record.steam_id);
	const now = isoNow();

	if (ownsCoH === true) {
		await patchSmurfWatch(env, record.id, {
			status: 'not_smurf',
			owns_coh: true,
			last_checked_at: now
		});
		return;
	}

	if (ownsCoH === false) {
		const cohStatsLender = await getCohStatsLender(record.steam_id);
		if (cohStatsLender) {
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

		await patchSmurfWatch(env, record.id, {
			status: 'watching',
			owns_coh: false,
			last_checked_at: now,
			next_check_at: now,
			check_interval_sec: 300
		});
		return;
	}

	await patchSmurfWatch(env, record.id, {
		status: 'watching',
		owns_coh: null,
		last_checked_at: now,
		next_check_at: now,
		check_interval_sec: 900,
		priority: Math.max(0, record.priority - 10)
	});
}

async function pollRecords(env: Env, records: SmurfWatchRecord[]): Promise<void> {
	if (records.length === 0) {
		return;
	}

	const summaries = await getPlayerSummaries(
		env,
		records.map((record) => record.steam_id)
	);

	const playingCoH = records.filter((record) => {
		const summary = summaries.get(record.steam_id);
		return summary?.gameid === String(COH_APP_ID) || record.source === 'lobby_live';
	});

	for (const record of playingCoH) {
		const lender = await getLenderSteamId(env, record.steam_id);
		const now = isoNow();

		if (lender) {
			await patchSmurfWatch(env, record.id, {
				status: 'resolved',
				lender_steam_id: lender,
				lender_source: 'live',
				last_checked_at: now,
				next_check_at: null
			});
			await sleep(1000);
			continue;
		}

		const interval = nextBackoffSeconds(record.check_interval_sec || 300);
		await patchSmurfWatch(env, record.id, {
			last_checked_at: now,
			next_check_at: isoAfterSeconds(interval),
			check_interval_sec: interval
		});
		await sleep(1000);
	}

	const offline = records.filter((record) => !playingCoH.includes(record));
	for (const record of offline) {
		const interval = nextBackoffSeconds(record.check_interval_sec || 300);
		await patchSmurfWatch(env, record.id, {
			last_checked_at: isoNow(),
			next_check_at: isoAfterSeconds(interval),
			check_interval_sec: interval
		});
	}
}

export async function runSmurfWorker(env: Env): Promise<void> {
	const batch = await fetchWorkerBatch(env);

	for (const record of batch.screening) {
		try {
			await screenRecord(env, record);
			await sleep(1000);
		} catch (error) {
			if (error instanceof RateLimitError) {
				console.warn('Steam rate limit during screening', error.retryAfterSec);
				break;
			}
			console.error('Screening failed', record.steam_id, error);
		}
	}

	try {
		await pollRecords(env, batch.polling);
	} catch (error) {
		if (error instanceof RateLimitError) {
			console.warn('Steam rate limit during polling', error.retryAfterSec);
			return;
		}
		throw error;
	}
}
