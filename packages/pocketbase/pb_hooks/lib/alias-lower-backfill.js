/// <reference path="../../pb_data/types.d.ts" />

'use strict';

const BATCH = 500;

/**
 * Fills `player_ratings.alias_lower` for rows stored before the field existed. The empty
 * value is the cursor, so a restart picks up where it stopped. Plain SQL, so `updated`
 * (the search order) does not move. Lowercased in JS like the website's dual-write.
 */
function runBatch() {
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
	console.log(`[alias_lower_backfill] filled ${rows.length} rows`);
	return rows.length;
}

module.exports = { runBatch };
