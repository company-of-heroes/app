/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const notifications = app.findCollectionByNameOrId('notifications');
		const lobbyComments = app.findCollectionByNameOrId('lobby_comments');

		if (!notifications.fields.getByName('comment')) {
			notifications.fields.add(
				new RelationField({
					cascadeDelete: false,
					collectionId: lobbyComments.id,
					hidden: false,
					id: 'relation_notifications_comment',
					maxSelect: 1,
					minSelect: 0,
					name: 'comment',
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
			if (notifications.fields.getByName('comment')) {
				notifications.fields.removeByName('comment');
				app.save(notifications);
			}
		} catch {
			// already gone
		}
	}
);
