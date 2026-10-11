/// <reference path="../pb_data/types.d.ts" />

// Streaming time and the Streamer label are per Steam account: one row per (user, steamId).
// Rows from before this have an empty steamId; the first report from a Steam account claims it.
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('streaming_progress');

		if (!collection.fields.getByName('steamId')) {
			collection.fields.add(
				new Field({
					autogeneratePattern: '',
					hidden: false,
					id: 'text_streaming_progress_steam_id',
					max: 32,
					min: 0,
					name: 'steamId',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				})
			);
		}

		collection.indexes = [
			'CREATE UNIQUE INDEX `idx_streaming_progress_user_steam` ON `streaming_progress` (`user`, `steamId`)'
		];

		return app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('streaming_progress');

		if (collection.fields.getByName('steamId')) {
			collection.fields.removeByName('steamId');
		}

		collection.indexes = [
			'CREATE UNIQUE INDEX `idx_streaming_progress_user` ON `streaming_progress` (`user`)'
		];

		return app.save(collection);
	}
);
