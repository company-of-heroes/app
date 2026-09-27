/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('player_customizations');
		const background = collection.fields.getByName('background');
		if (!background) {
			return;
		}

		// PB content-sniff often rejects real .jpg uploads (and image/jpg).
		// We validate jpeg/png/webp ourselves in the player-customization hook.
		background.mimeTypes = [];
		app.save(collection);
	},
	(app) => {
		try {
			const collection = app.findCollectionByNameOrId('player_customizations');
			const background = collection.fields.getByName('background');
			if (!background) {
				return;
			}

			background.mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
			app.save(collection);
		} catch {
			// collection removed
		}
	}
);
