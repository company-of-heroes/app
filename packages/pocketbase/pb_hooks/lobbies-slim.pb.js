/// <reference path="../pb_data/types.d.ts" />

'use strict';

$app.onServe().bindFunc((e) => {
	e.next();

	// Runs more often than the other jobs on purpose: it is a one-off drain that
	// short-circuits once every row is slim.
	cronAdd('lobbies_slim_backfill', '*/2 * * * *', () => {
		const backfill = require(`${__hooks}/lib/lobbies-slim-backfill.js`);
		// New fat rows can appear after a prior "complete" (live lobby ingest).
		if (backfill.isComplete()) {
			if (backfill.countPending() === 0) {
				return;
			}

			backfill.reset();
		}

		const result = backfill.runBatch();
		console.log(
			`[lobbies_slim] batch processed=${result.processed} complete=${result.complete}`
		);
	});
});

routerAdd('POST', '/api/lobbies/slim/run', (e) => {
	const lobby = require(`${__hooks}/lib/lobby-players.js`);
	if (!lobby.isServiceRequest(e) && !e.hasSuperuserAuth()) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const backfill = require(`${__hooks}/lib/lobbies-slim-backfill.js`);
	const query = e.request.url.query();

	if (query.get('reset') === 'true') {
		backfill.reset();
	}

	const batches = Math.min(Math.max(parseInt(query.get('batches') || '1', 10) || 1, 1), 200);
	let processed = 0;
	let complete = false;

	for (let i = 0; i < batches && !complete; i++) {
		const result = backfill.runBatch();
		processed += result.processed;
		complete = result.complete;
	}

	return e.json(200, { processed, complete, pending: backfill.countPending() });
});

// VACUUM cannot run inside a transaction, so it gets its own explicit trigger.
routerAdd('POST', '/api/lobbies/vacuum', (e) => {
	const lobby = require(`${__hooks}/lib/lobby-players.js`);
	if (!lobby.isServiceRequest(e) && !e.hasSuperuserAuth()) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const startedAt = Number(new Date());
	$app.db().newQuery('VACUUM').execute();

	return e.json(200, { vacuumed: true, ms: Number(new Date()) - startedAt });
});
