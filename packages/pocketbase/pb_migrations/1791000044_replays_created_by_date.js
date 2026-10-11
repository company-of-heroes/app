/// <reference path="../pb_data/types.d.ts" />

// The replay list filters `createdBy = ?` and sorts `-gameDate`. The only createdBy
// indexes are partial (`createdBy != ''`), which SQLite cannot use for `createdBy = ?`,
// so every page scanned all replays and sorted them. replays is ~23k rows: cheap to index here.
migrate(
	(app) => {
		const replays = app.findCollectionByNameOrId('replays');
		replays.indexes.push(
			'CREATE INDEX `idx_replays_createdBy_gameDate` ON `replays` (`createdBy`, `gameDate`)'
		);
		app.save(replays);
		app.db().newQuery('ANALYZE replays').execute();
	},
	(app) => {
		const replays = app.findCollectionByNameOrId('replays');
		replays.indexes = replays.indexes.filter(
			(index) => !index.includes('`idx_replays_createdBy_gameDate`')
		);
		app.save(replays);
	}
);
