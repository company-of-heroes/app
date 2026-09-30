/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('lobbies');

		if (!collection.fields.getByName('hasFailed')) {
			collection.fields.add(
				new BoolField({
					hidden: false,
					id: 'bool_lobby_has_failed',
					name: 'hasFailed',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		if (!collection.fields.getByName('resultAttempts')) {
			collection.fields.add(
				new NumberField({
					hidden: false,
					id: 'number_lobby_result_attempts',
					max: null,
					min: 0,
					name: 'resultAttempts',
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
		const collection = app.findCollectionByNameOrId('lobbies');

		if (collection.fields.getByName('hasFailed')) {
			collection.fields.removeByName('hasFailed');
		}

		if (collection.fields.getByName('resultAttempts')) {
			collection.fields.removeByName('resultAttempts');
		}

		app.save(collection);
	}
);
