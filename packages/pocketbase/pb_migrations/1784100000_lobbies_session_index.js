/// <reference path="../pb_data/types.d.ts" />

const SESSION_INDEX = 'CREATE INDEX `idx_lobbies_sessionId` ON `lobbies` (`sessionId`)';

function collectionIndexes(app) {
	const row = new DynamicModel({ indexes: '' });
	app.db().newQuery("SELECT indexes FROM _collections WHERE name='lobbies'").one(row);
	return JSON.parse(row.indexes || '[]');
}

function saveCollectionIndexes(app, indexes) {
	app
		.db()
		.newQuery("UPDATE _collections SET indexes={:indexes} WHERE name='lobbies'")
		.bind({ indexes: JSON.stringify(indexes) })
		.execute();
}

migrate(
	(app) => {
		app
			.db()
			.newQuery('CREATE INDEX IF NOT EXISTS `idx_lobbies_sessionId` ON `lobbies` (`sessionId`)')
			.execute();

		const indexes = collectionIndexes(app);
		if (indexes.some((sql) => sql.includes('idx_lobbies_sessionId'))) {
			return;
		}

		indexes.push(SESSION_INDEX);
		saveCollectionIndexes(app, indexes);
	},
	(app) => {
		app.db().newQuery('DROP INDEX IF EXISTS `idx_lobbies_sessionId`').execute();
		saveCollectionIndexes(
			app,
			collectionIndexes(app).filter((sql) => !sql.includes('idx_lobbies_sessionId'))
		);
	}
);
