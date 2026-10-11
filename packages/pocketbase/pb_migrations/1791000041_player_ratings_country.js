/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('player_ratings');

		if (!collection.fields.getByName('country')) {
			collection.fields.add(
				new Field({
					autogeneratePattern: '',
					hidden: false,
					id: 'text_player_ratings_country',
					max: 8,
					min: 0,
					name: 'country',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				})
			);
		}

		return app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('player_ratings');

		if (collection.fields.getByName('country')) {
			collection.fields.removeByName('country');
		}

		return app.save(collection);
	}
);
