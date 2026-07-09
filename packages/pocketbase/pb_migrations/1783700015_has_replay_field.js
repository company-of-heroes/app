/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
	const collection = app.findCollectionByNameOrId('lobbies');

	if (!collection.fields.getByName('hasReplay')) {
		collection.fields.add(
			new BoolField({
				hidden: false,
				id: 'bool_has_replay',
				name: 'hasReplay',
				presentable: false,
				required: false,
				system: false
			})
		);
	}

	app.save(collection);
}, (app) => {
	const collection = app.findCollectionByNameOrId('lobbies');

	if (collection.fields.getByName('hasReplay')) {
		collection.fields.removeByName('hasReplay');
	}

	app.save(collection);
});
