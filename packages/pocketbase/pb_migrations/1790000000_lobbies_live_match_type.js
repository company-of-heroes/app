/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('lobbies_live');

		if (!collection.fields.getByName('matchType')) {
			collection.fields.add(
				new NumberField({
					hidden: false,
					id: 'number_lobbies_live_match_type',
					max: null,
					min: null,
					name: 'matchType',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('lobbies_live');

		if (collection.fields.getByName('matchType')) {
			collection.fields.removeByName('matchType');
		}

		app.save(collection);
	}
);
