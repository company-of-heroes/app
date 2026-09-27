/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('player_customizations');
		collection.listRule = '';
		collection.viewRule = '';
		collection.createRule = '@request.auth.id != "" && @request.body.user = @request.auth.id';
		collection.updateRule = 'user = @request.auth.id';
		collection.deleteRule = 'user = @request.auth.id';
		app.save(collection);
	},
	(app) => {
		try {
			const collection = app.findCollectionByNameOrId('player_customizations');
			collection.listRule = '';
			collection.viewRule = '';
			collection.createRule = null;
			collection.updateRule = null;
			collection.deleteRule = null;
			app.save(collection);
		} catch {
			// collection removed
		}
	}
);
