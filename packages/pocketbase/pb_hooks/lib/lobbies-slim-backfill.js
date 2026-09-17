'use strict';

const SLIM_BATCH_SIZE = 100;
const JOB_ID = 'lobbies_slim_backfill';
const jobState = require(`${__hooks}/lib/job-state.js`);

/**
 * Rewrites `lobbies.players` without the heavy per-player payloads. Done in
 * pure SQL so the ~438 KB blobs never cross into the JS runtime.
 *
 * Self-draining: it repeatedly picks the next rows that still contain a heavy
 * key, so it is safe to re-run and needs no page cursor. The cron reopens after
 * complete when new fat rows appear.
 */
const MATCHES_HEAVY = `(players LIKE '%"matchHistory"%' OR players LIKE '%"storedElo"%')`;

const SELECT_PENDING = `SELECT id FROM lobbies
	WHERE players IS NOT NULL AND players != '' AND ${MATCHES_HEAVY}
	LIMIT {:limit}`;

const STRIP_SQL = `UPDATE lobbies
SET players = (
	SELECT json_group_array(
		CASE
			WHEN json_type(p.value) = 'object'
			THEN json_remove(p.value, '$.matchHistory', '$.storedElo')
			ELSE json(p.value)
		END
	)
	FROM json_each(lobbies.players) AS p
)
WHERE id IN (${SELECT_PENDING})
	AND json_valid(players)
	AND json_type(players) = 'array'`;

function countPending() {
	const rows = arrayOf(new DynamicModel({ n: 0 }));
	$app
		.db()
		.newQuery(
			`SELECT COUNT(*) AS n FROM lobbies
			 WHERE players IS NOT NULL AND players != '' AND ${MATCHES_HEAVY}`
		)
		.all(rows);
	return rows.length > 0 ? Number(rows[0].n) : 0;
}

function isComplete() {
	return jobState.isComplete(JOB_ID);
}

function runBatch() {
	if (isComplete()) {
		return { processed: 0, complete: true };
	}

	const pending = arrayOf(new DynamicModel({ id: '' }));
	$app.db().newQuery(SELECT_PENDING).bind({ limit: SLIM_BATCH_SIZE }).all(pending);

	if (pending.length === 0) {
		jobState.setComplete(JOB_ID, 1);
		return { processed: 0, complete: true };
	}

	$app.db().newQuery(STRIP_SQL).bind({ limit: SLIM_BATCH_SIZE }).execute();

	const complete = pending.length < SLIM_BATCH_SIZE;
	if (complete) {
		jobState.setComplete(JOB_ID, 1);
	} else {
		jobState.setPage(JOB_ID, 1);
	}

	return { processed: pending.length, complete };
}

function reset() {
	jobState.reset(JOB_ID);
}

module.exports = {
	isComplete,
	runBatch,
	reset,
	countPending
};
