/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const lobbiesLive = app.findCollectionByNameOrId('lobbies_live');
		const lobbies = app.findCollectionByNameOrId('lobbies');

		if (!lobbiesLive.fields.getByName('lobby')) {
			lobbiesLive.fields.add(
				new RelationField({
					cascadeDelete: false,
					collectionId: lobbies.id,
					hidden: false,
					id: 'relation_lobbies_live_lobby',
					maxSelect: 1,
					minSelect: 0,
					name: 'lobby',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		app.save(lobbiesLive);
	},
	(app) => {
		try {
			const lobbiesLive = app.findCollectionByNameOrId('lobbies_live');
			if (lobbiesLive.fields.getByName('lobby')) {
				lobbiesLive.fields.removeByName('lobby');
				app.save(lobbiesLive);
			}
		} catch {
			// already gone
		}
	}
);
