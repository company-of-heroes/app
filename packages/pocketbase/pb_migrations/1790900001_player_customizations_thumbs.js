/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('player_customizations');
		const background = collection.fields.getByName('background');
		if (!background) {
			return;
		}

		background.maxSize = 5242880;
		background.mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
		background.thumbs = ['800x0', '1600x0'];
		app.save(collection);
	},
	(app) => {
		try {
			const collection = app.findCollectionByNameOrId('player_customizations');
			const background = collection.fields.getByName('background');
			if (!background) {
				return;
			}

			background.maxSize = 2097152;
			background.thumbs = [];
			app.save(collection);
		} catch {
			// collection removed
		}
	}
);
