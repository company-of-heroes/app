/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const comments = app.findCollectionByNameOrId('lobby_comments');
		const staff = '@request.auth.role = "admin" || @request.auth.role = "moderator"';

		if (!comments.fields.getByName('deleted')) {
			comments.fields.add(
				new BoolField({
					hidden: false,
					id: 'bool_lobby_comments_deleted',
					name: 'deleted',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		if (!comments.fields.getByName('deletedAt')) {
			comments.fields.add(
				new DateField({
					hidden: false,
					id: 'date_lobby_comments_deleted_at',
					max: '',
					min: '',
					name: 'deletedAt',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		if (!comments.fields.getByName('deletedBy')) {
			comments.fields.add(
				new RelationField({
					cascadeDelete: false,
					collectionId: '_pb_users_auth_',
					hidden: false,
					id: 'relation_lobby_comments_deleted_by',
					maxSelect: 1,
					minSelect: 0,
					name: 'deletedBy',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		if (!comments.fields.getByName('deletedNote')) {
			comments.fields.add(
				new TextField({
					autogeneratePattern: '',
					hidden: false,
					id: 'text_lobby_comments_deleted_note',
					max: 500,
					min: 0,
					name: 'deletedNote',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false
				})
			);
		}

		comments.listRule = `deleted != true || ${staff}`;
		comments.viewRule = `deleted != true || ${staff}`;
		comments.deleteRule = null;

		app.save(comments);
	},
	(app) => {
		const comments = app.findCollectionByNameOrId('lobby_comments');

		for (const name of ['deletedNote', 'deletedBy', 'deletedAt', 'deleted']) {
			if (comments.fields.getByName(name)) {
				comments.fields.removeByName(name);
			}
		}

		comments.listRule = '';
		comments.viewRule = '';
		comments.deleteRule =
			'user = @request.auth.id || @request.auth.role = "admin" || @request.auth.role = "moderator"';

		app.save(comments);
	}
);
