/// <reference path="../pb_data/types.d.ts" />

// Lowercase alias for the player search: a prefix range on an index instead of a LIKE scan.
// Existing rows are filled by the `alias_lower_backfill` cron; new writes set it themselves.
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('player_ratings');

		if (!collection.fields.getByName('alias_lower')) {
			collection.fields.add(
				new Field({
					autogeneratePattern: '',
					hidden: false,
					id: 'text_player_ratings_alias_lower',
					max: 0,
					min: 0,
					name: 'alias_lower',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				})
			);
		}

		const indexes = [];
		for (const index of collection.indexes) {
			indexes.push(index);
		}
		if (!indexes.some((index) => String(index).includes('idx_player_ratings_alias_lower'))) {
			indexes.push(
				'CREATE INDEX `idx_player_ratings_alias_lower` ON `player_ratings` (`alias_lower`)'
			);
			collection.indexes = indexes;
		}

		return app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('player_ratings');

		const indexes = [];
		for (const index of collection.indexes) {
			if (!String(index).includes('idx_player_ratings_alias_lower')) {
				indexes.push(index);
			}
		}
		collection.indexes = indexes;

		if (collection.fields.getByName('alias_lower')) {
			collection.fields.removeByName('alias_lower');
		}

		return app.save(collection);
	}
);
