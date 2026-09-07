/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const replays = app.findCollectionByNameOrId('replays');
		const staff = '@request.auth.role = "admin" || @request.auth.role = "moderator"';

		let comments;
		try {
			comments = app.findCollectionByNameOrId('replay_comments');
		} catch {
			comments = new Collection({
				createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
				deleteRule: null,
				listRule: `deleted != true || ${staff}`,
				viewRule: `deleted != true || ${staff}`,
				updateRule:
					'user = @request.auth.id || @request.auth.role = "admin" || @request.auth.role = "moderator"',
				name: 'replay_comments',
				type: 'base',
				id: 'pbc_5728193053',
				indexes: ['CREATE INDEX `idx_replay_comments_replay` ON `replay_comments` (`replay`)'],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: 'text_replay_comments_id',
						max: 15,
						min: 15,
						name: 'id',
						pattern: '^[a-z0-9]+$',
						presentable: false,
						primaryKey: true,
						required: true,
						system: true,
						type: 'text'
					},
					{
						cascadeDelete: true,
						collectionId: replays.id,
						hidden: false,
						id: 'relation_replay_comments_replay',
						maxSelect: 1,
						minSelect: 1,
						name: 'replay',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						cascadeDelete: false,
						collectionId: '_pb_users_auth_',
						hidden: false,
						id: 'relation_replay_comments_user',
						maxSelect: 1,
						minSelect: 1,
						name: 'user',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: 'text_replay_comments_text',
						max: 2000,
						min: 1,
						name: 'text',
						pattern: '',
						presentable: true,
						primaryKey: false,
						required: true,
						system: false,
						type: 'text'
					},
					{
						hidden: false,
						id: 'number_replay_comments_like_count',
						max: null,
						min: null,
						name: 'likeCount',
						onlyInt: true,
						presentable: false,
						required: false,
						system: false,
						type: 'number'
					},
					{
						hidden: false,
						id: 'bool_replay_comments_deleted',
						name: 'deleted',
						presentable: false,
						required: false,
						system: false,
						type: 'bool'
					},
					{
						hidden: false,
						id: 'date_replay_comments_deleted_at',
						max: '',
						min: '',
						name: 'deletedAt',
						presentable: false,
						required: false,
						system: false,
						type: 'date'
					},
					{
						cascadeDelete: false,
						collectionId: '_pb_users_auth_',
						hidden: false,
						id: 'relation_replay_comments_deleted_by',
						maxSelect: 1,
						minSelect: 0,
						name: 'deletedBy',
						presentable: false,
						required: false,
						system: false,
						type: 'relation'
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: 'text_replay_comments_deleted_note',
						max: 500,
						min: 0,
						name: 'deletedNote',
						pattern: '',
						presentable: false,
						primaryKey: false,
						required: false,
						system: false,
						type: 'text'
					},
					{
						hidden: false,
						id: 'autodate_replay_comments_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_replay_comments_updated',
						name: 'updated',
						onCreate: true,
						onUpdate: true,
						presentable: false,
						system: false,
						type: 'autodate'
					}
				]
			});
			app.save(comments);
			comments = app.findCollectionByNameOrId('replay_comments');
		}

		if (!comments.fields.getByName('parent')) {
			comments.fields.add(
				new RelationField({
					cascadeDelete: true,
					collectionId: comments.id,
					hidden: false,
					id: 'relation_replay_comments_parent',
					maxSelect: 1,
					minSelect: 0,
					name: 'parent',
					presentable: false,
					required: false,
					system: false
				})
			);
			const parentIndex = 'CREATE INDEX `idx_replay_comments_parent` ON `replay_comments` (`parent`)';
			if (!comments.indexes.includes(parentIndex)) {
				comments.indexes.push(parentIndex);
			}
			app.save(comments);
		}

		try {
			app.findCollectionByNameOrId('replay_comment_likes');
		} catch {
			const likes = new Collection({
				createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
				deleteRule: 'user = @request.auth.id',
				listRule: '',
				viewRule: '',
				updateRule: 'user = @request.auth.id',
				name: 'replay_comment_likes',
				type: 'base',
				id: 'pbc_5728193054',
				indexes: [
					'CREATE UNIQUE INDEX `idx_replay_comment_likes_comment_user` ON `replay_comment_likes` (`comment`, `user`)',
					'CREATE INDEX `idx_replay_comment_likes_comment` ON `replay_comment_likes` (`comment`)'
				],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: 'text_replay_comment_likes_id',
						max: 15,
						min: 15,
						name: 'id',
						pattern: '^[a-z0-9]+$',
						presentable: false,
						primaryKey: true,
						required: true,
						system: true,
						type: 'text'
					},
					{
						cascadeDelete: true,
						collectionId: comments.id,
						hidden: false,
						id: 'relation_replay_comment_likes_comment',
						maxSelect: 1,
						minSelect: 1,
						name: 'comment',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						cascadeDelete: true,
						collectionId: '_pb_users_auth_',
						hidden: false,
						id: 'relation_replay_comment_likes_user',
						maxSelect: 1,
						minSelect: 1,
						name: 'user',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						hidden: false,
						id: 'number_replay_comment_likes_value',
						max: 1,
						min: -1,
						name: 'value',
						onlyInt: true,
						presentable: false,
						required: true,
						system: false,
						type: 'number'
					},
					{
						hidden: false,
						id: 'autodate_replay_comment_likes_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_replay_comment_likes_updated',
						name: 'updated',
						onCreate: true,
						onUpdate: true,
						presentable: false,
						system: false,
						type: 'autodate'
					}
				]
			});
			app.save(likes);
		}

		const notifications = app.findCollectionByNameOrId('notifications');

		if (!notifications.fields.getByName('replay')) {
			notifications.fields.add(
				new RelationField({
					cascadeDelete: false,
					collectionId: replays.id,
					hidden: false,
					id: 'relation_notifications_replay',
					maxSelect: 1,
					minSelect: 0,
					name: 'replay',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		if (!notifications.fields.getByName('replayComment')) {
			notifications.fields.add(
				new RelationField({
					cascadeDelete: false,
					collectionId: comments.id,
					hidden: false,
					id: 'relation_notifications_replay_comment',
					maxSelect: 1,
					minSelect: 0,
					name: 'replayComment',
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
			if (notifications.fields.getByName('replayComment')) {
				notifications.fields.removeByName('replayComment');
			}
			if (notifications.fields.getByName('replay')) {
				notifications.fields.removeByName('replay');
			}
			app.save(notifications);
		} catch {
			// already gone
		}

		try {
			app.delete(app.findCollectionByNameOrId('replay_comment_likes'));
		} catch {
			// already gone
		}

		try {
			app.delete(app.findCollectionByNameOrId('replay_comments'));
		} catch {
			// already gone
		}
	}
);
