/// <reference path="../pb_data/types.d.ts" />

'use strict';

$app.onServe().bindFunc((e) => {
	const { debugLog } = require(`${__hooks}/lib/debug-log.js`);
	const serveStart = Date.now();

	// #region agent log
	debugLog('smurf-watch.pb.js:onServe', 'serve start', { serveStart }, 'B');
	// #endregion

	e.next();

	cronAdd('smurf_watch_backfill', '*/5 * * * *', () => {
		const backfill = require(`${__hooks}/lib/smurf-watch-backfill.js`);
		if (backfill.isComplete()) {
			return;
		}

		const result = backfill.runBatch();
		console.log(
			`[smurf_watch] backfill batch processed=${result.processed} enqueued=${result.enqueued} complete=${result.complete}`
		);
	});

	// #region agent log
	debugLog(
		'smurf-watch.pb.js:onServe',
		'cron registered (backfill deferred)',
		{ durationMs: Date.now() - serveStart },
		'B'
	);
	// #endregion
});

routerAdd('POST', '/api/smurf-watch/backfill/run', (e) => {
	const smurf = require(`${__hooks}/lib/smurf-watch.js`);
	if (!smurf.isServiceRequest(e) && !e.hasSuperuserAuth()) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const smurfBackfill = require(`${__hooks}/lib/smurf-watch-backfill.js`);
	const reset = e.request.url.query().get('reset') === 'true';
	if (reset) {
		smurfBackfill.reset();
	}

	const result = smurfBackfill.runBatch();

	return e.json(200, {
		...result,
		page: smurfBackfill.getPage(),
		complete: smurfBackfill.isComplete()
	});
});

routerAdd('POST', '/api/smurf-watch/enqueue', (e) => {
	return require(`${__hooks}/lib/smurf-watch.js`).handleEnqueue(e);
});

routerAdd('GET', '/api/smurf-watch/{steamId}', (e) => {
	return require(`${__hooks}/lib/smurf-watch.js`).handleGetBySteamId(e);
});

routerAdd('GET', '/api/smurf-watch/worker/batch', (e) => {
	return require(`${__hooks}/lib/smurf-watch.js`).handleWorkerBatch(e);
});

routerAdd('GET', '/api/smurf-watch/worker/coplay/{profileId}', (e) => {
	return require(`${__hooks}/lib/smurf-watch.js`).handleCoplay(e);
});

routerAdd('PATCH', '/api/smurf-watch/worker/{id}', (e) => {
	return require(`${__hooks}/lib/smurf-watch.js`).handleWorkerPatch(e);
});

onRecordAfterCreateSuccess((e) => {
	require(`${__hooks}/lib/smurf-watch.js`).enqueueLobbyMatchRecord(e);
}, 'lobbies');

onRecordAfterCreateSuccess((e) => {
	require(`${__hooks}/lib/smurf-watch.js`).enqueueLobbyLiveRecord(e);
}, 'lobbies_live');

onRecordAfterUpdateSuccess((e) => {
	require(`${__hooks}/lib/smurf-watch.js`).enqueueLobbyLiveRecord(e);
}, 'lobbies_live');
