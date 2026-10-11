/// <reference path="../../pb_data/types.d.ts" />

'use strict';

/**
 * Indexes on large tables (lobbies, lobby_player_index) that must not be built in a
 * migration: `CREATE INDEX` there would block `Server started`. The cron in
 * deferred-indexes.pb.js builds one missing entry per run, after the server listens.
 *
 * To add one: append `{ collection, name, sql }` where `sql` is the exact
 * `CREATE INDEX` statement stored in `collection.indexes` and `name` is its index name:
 *
 *   {
 *     collection: 'lobbies',
 *     name: 'idx_lobbies_example',
 *     sql: 'CREATE INDEX `idx_lobbies_example` ON `lobbies` (`user`, `createdAt`)'
 *   }
 *
 * Entries are never removed by the cron; drop an index with a normal migration.
 *
 * @type {Array<{ collection: string; name: string; sql: string }>}
 */
const DEFERRED_INDEXES = [];

function existsInDb(entry) {
	const row = new DynamicModel({ name: '' });
	$app
		.db()
		.newQuery("SELECT name FROM sqlite_master WHERE type = 'index' AND name = {:name}")
		.bind({ name: entry.name })
		.one(row);
	return row.name === entry.name;
}

function isPresent(entry) {
	try {
		return existsInDb(entry);
	} catch {
		// `one()` throws when no row matches
		return false;
	}
}

function nextMissing() {
	return DEFERRED_INDEXES.find((entry) => !isPresent(entry)) ?? null;
}

/** Builds the first missing index, if any, and analyzes its table. */
function runNext() {
	const entry = nextMissing();
	if (!entry) {
		return;
	}

	const label = `${entry.collection}.${entry.name}`;
	const startedAt = Date.now();
	console.log(`[deferred-indexes] building ${label}`);
	try {
		const collection = $app.findCollectionByNameOrId(entry.collection);
		if (!collection.indexes.some((index) => index.includes(`\`${entry.name}\``))) {
			collection.indexes.push(entry.sql);
		}

		// Saving creates the index in SQLite; it is already in `indexes` if only the DB is behind.
		$app.save(collection);
		$app.db().newQuery(`ANALYZE ${entry.collection}`).execute();
		console.log(`[deferred-indexes] built ${label} in ${Date.now() - startedAt}ms`);
	} catch (error) {
		console.log(`[deferred-indexes] failed ${label} after ${Date.now() - startedAt}ms: ${error}`);
	}
}

module.exports = { DEFERRED_INDEXES, runNext };
