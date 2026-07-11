/// <reference path="../pb_data/types.d.ts" />

'use strict';

onRecordCreate((e) => {
	require(`${__hooks}/lib/lobby-players.js`).processLobbyRecord(e);
	e.next();
}, 'lobbies');

onRecordUpdate((e) => {
	require(`${__hooks}/lib/lobby-players.js`).processLobbyRecord(e);
	e.next();
}, 'lobbies');

onRecordAfterCreateSuccess((e) => {
	require(`${__hooks}/lib/lobby-players.js`).syncLobbyPlayerIndexForRecord(e);
}, 'lobbies');

onRecordAfterUpdateSuccess((e) => {
	require(`${__hooks}/lib/lobby-players.js`).syncLobbyPlayerIndexForRecord(e);
}, 'lobbies');

$app.onServe().bindFunc((e) => {
	const { debugLog } = require(`${__hooks}/lib/debug-log.js`);
	const serveStart = Date.now();

	// #region agent log
	debugLog('lobby-players.pb.js:onServe', 'serve start', { serveStart }, 'B');
	// #endregion

	e.next();

	cronAdd('lobby_players_backfill', '*/5 * * * *', () => {
		const backfill = require(`${__hooks}/lib/lobby-players-backfill.js`);
		if (backfill.isComplete()) {
			return;
		}

		const result = backfill.runBatch();
		console.log(
			`[lobby_players] backfill batch processed=${result.processed} updated=${result.updated} indexed=${result.indexed} complete=${result.complete}`
		);
	});

	// #region agent log
	debugLog(
		'lobby-players.pb.js:onServe',
		'cron registered (backfill deferred)',
		{ durationMs: Date.now() - serveStart },
		'B'
	);
	// #endregion
});

routerAdd('POST', '/api/lobby-players/backfill/run', (e) => {
	const lobby = require(`${__hooks}/lib/lobby-players.js`);
	if (!lobby.isServiceRequest(e) && !e.hasSuperuserAuth()) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const lobbyBackfill = require(`${__hooks}/lib/lobby-players-backfill.js`);
	const reset = e.request.url.query().get('reset') === 'true';
	if (reset) {
		lobbyBackfill.reset();
	}

	const result = lobbyBackfill.runBatch();

	return e.json(200, {
		...result,
		page: lobbyBackfill.getPage(),
		complete: lobbyBackfill.isComplete()
	});
});
