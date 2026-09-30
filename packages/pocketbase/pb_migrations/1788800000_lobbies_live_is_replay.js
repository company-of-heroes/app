/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('lobbies_live');

		if (!collection.fields.getByName('isReplay')) {
			collection.fields.add(
				new BoolField({
					hidden: false,
					id: 'bool_lobbies_live_is_replay',
					name: 'isReplay',
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

		if (collection.fields.getByName('isReplay')) {
			collection.fields.removeByName('isReplay');
		}

		app.save(collection);
	}
);
