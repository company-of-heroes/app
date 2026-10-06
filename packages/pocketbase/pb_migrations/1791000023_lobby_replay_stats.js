/// <reference path="../pb_data/types.d.ts" />

// What each human player picked and built according to the lobby's replay (doctrine, units,
// upgrades, opening) for community statistics. Filled by the website's `replay-stats` job.
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('lobbies');
		if (!collection.fields.getByName('replayStats')) {
			collection.fields.add(
				new Field({
					hidden: false,
					id: 'json_lobbies_replay_stats',
					maxSize: 20000,
					name: 'replayStats',
					presentable: false,
					required: false,
					system: false,
					type: 'json'
				})
			);
			app.save(collection);
		}
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('lobbies');
		if (collection.fields.getByName('replayStats')) {
			collection.fields.removeByName('replayStats');
			app.save(collection);
		}
	}
);
