/// <reference path="../../pb_data/types.d.ts" />

'use strict';

const BATCH = 500;
const MAX_BATCHES = 10;

/**
 * Fills `player_ratings.alias_lower` for rows stored before the field existed. The empty
 * value is the cursor, so a restart picks up where it stopped. Plain SQL, so `updated`
 * (the search order) does not move.
 *
 * ASCII-only aliases go in one statement: SQLite `lower()` only folds ASCII, which is exactly
 * what JS `toLowerCase()` does for those. Everything else is lowercased in JS like the
 * website's dual-write, a few batches per run.
 */
function runBatch() {
	const ascii = $app
		.db()
		.newQuery(
			"UPDATE player_ratings SET alias_lower = lower(alias) WHERE alias_lower = '' AND alias != '' AND alias NOT GLOB '*[^ -~]*'"
		)
		.execute()
		.rowsAffected();
	let filled = ascii;
	for (let i = 0; i < MAX_BATCHES; i++) {
		const count = runUnicodeBatch();
		filled += count;
		if (count < BATCH) {
			break;
		}
	}

	if (filled > 0) {
		console.log(`[alias_lower_backfill] filled ${filled} rows (${ascii} ascii)`);
	}

	return filled;
}

function runUnicodeBatch() {
	const rows = arrayOf(new DynamicModel({ id: '', alias: '' }));
	$app
		.db()
		.newQuery(
			"SELECT id, alias FROM player_ratings WHERE alias_lower = '' AND alias != '' LIMIT {:limit}"
		)
		.bind({ limit: BATCH })
		.all(rows);
	if (rows.length === 0) {
		return 0;
	}

	$app.runInTransaction((txApp) => {
		for (const row of rows) {
			txApp
				.db()
				.newQuery('UPDATE player_ratings SET alias_lower = {:lower} WHERE id = {:id}')
				.bind({ lower: String(row.alias).toLowerCase(), id: row.id })
				.execute();
		}
	});
	return rows.length;
}

module.exports = { runBatch };
