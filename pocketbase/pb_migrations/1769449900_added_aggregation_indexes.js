/// <reference path="../pb_data/types.d.ts" />
migrate(
	(app) => {
		const lobbies = app.findCollectionByNameOrId('pbc_1574334436');
		lobbies.indexes = [
			...lobbies.indexes,
			'CREATE INDEX `idx_lobbies_user_map_agg` ON `lobbies` (`user`, `map`)',
			'CREATE INDEX `idx_lobbies_map_agg` ON `lobbies` (`map`)'
		];

		const replays = app.findCollectionByNameOrId('pbc_3644265509');
		replays.indexes = [
			...replays.indexes,
			"CREATE INDEX `idx_replays_createdBy_mapName_agg` ON `replays` (`createdBy`, `mapName`) WHERE `createdBy` != ''"
		];

		app.save(lobbies);
		return app.save(replays);
	},
	(app) => {
		const lobbies = app.findCollectionByNameOrId('pbc_1574334436');
		lobbies.indexes = lobbies.indexes.filter(
			(index) =>
				!index.includes('idx_lobbies_user_map_agg') && !index.includes('idx_lobbies_map_agg')
		);

		const replays = app.findCollectionByNameOrId('pbc_3644265509');
		replays.indexes = replays.indexes.filter(
			(index) => !index.includes('idx_replays_createdBy_mapName_agg')
		);

		app.save(lobbies);
		return app.save(replays);
	}
);
