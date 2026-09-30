/// <reference path="../pb_data/types.d.ts" />

function indexList(collection) {
	const indexes = [];
	const raw = collection.indexes || [];
	for (let i = 0; i < raw.length; i++) {
		indexes.push(raw[i]);
	}
	return indexes;
}

migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('lobbies_live');
		const sql = 'CREATE INDEX `idx_lobbies_live_updatedAt` ON `lobbies_live` (`updatedAt`)';
		const indexes = indexList(collection);
		if (indexes.some((item) => String(item).includes('idx_lobbies_live_updatedAt'))) {
			return;
		}

		unmarshal({ indexes: indexes.concat(sql) }, collection);
		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('lobbies_live');
		unmarshal(
			{
				indexes: indexList(collection).filter(
					(item) => !String(item).includes('idx_lobbies_live_updatedAt')
				)
			},
			collection
		);
		app.save(collection);
	}
);
