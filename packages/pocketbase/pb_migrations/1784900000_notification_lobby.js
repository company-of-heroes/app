/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const notifications = app.findCollectionByNameOrId('notifications');
		const lobbies = app.findCollectionByNameOrId('lobbies');

		if (!notifications.fields.getByName('lobby')) {
			notifications.fields.add(
				new RelationField({
					cascadeDelete: false,
					collectionId: lobbies.id,
					hidden: false,
					id: 'relation_notifications_lobby',
					maxSelect: 1,
					minSelect: 0,
					name: 'lobby',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		app.save(notifications);
	},
	(app) => {
		try {
			const notifications = app.findCollectionByNameOrId('notifications');
			if (notifications.fields.getByName('lobby')) {
				notifications.fields.removeByName('lobby');
				app.save(notifications);
			}
		} catch {
			// already gone
		}
	}
);
