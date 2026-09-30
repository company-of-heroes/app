/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const comments = app.findCollectionByNameOrId('lobby_comments');

		if (!comments.fields.getByName('likeCount')) {
			comments.fields.add(
				new NumberField({
					hidden: false,
					id: 'number_lobby_comments_like_count',
					max: null,
					min: 0,
					name: 'likeCount',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		if (!comments.fields.getByName('parent')) {
			comments.fields.add(
				new RelationField({
					cascadeDelete: true,
					collectionId: comments.id,
					hidden: false,
					id: 'relation_lobby_comments_parent',
					maxSelect: 1,
					minSelect: 0,
					name: 'parent',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		const parentIndex = 'CREATE INDEX `idx_lobby_comments_parent` ON `lobby_comments` (`parent`)';
		if (!comments.indexes.includes(parentIndex)) {
			comments.indexes.push(parentIndex);
		}

		app.save(comments);

		try {
			app.findCollectionByNameOrId('lobby_comment_likes');
		} catch {
			const likes = new Collection({
				createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
				deleteRule: 'user = @request.auth.id',
				listRule: '',
				viewRule: '',
				updateRule: null,
				name: 'lobby_comment_likes',
				type: 'base',
				id: 'pbc_5728193044',
				indexes: [
					'CREATE UNIQUE INDEX `idx_lobby_comment_likes_comment_user` ON `lobby_comment_likes` (`comment`, `user`)',
					'CREATE INDEX `idx_lobby_comment_likes_comment` ON `lobby_comment_likes` (`comment`)'
				],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: 'text3208210256',
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
						id: 'relation_lobby_comment_likes_comment',
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
						id: 'relation_lobby_comment_likes_user',
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
						id: 'autodate_lobby_comment_likes_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_lobby_comment_likes_updated',
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
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('lobby_comment_likes'));
		} catch {
			// already gone
		}

		try {
			const comments = app.findCollectionByNameOrId('lobby_comments');
			if (comments.fields.getByName('parent')) {
				comments.fields.removeByName('parent');
			}

			if (comments.fields.getByName('likeCount')) {
				comments.fields.removeByName('likeCount');
			}

			comments.indexes = comments.indexes.filter(
				(index) => !String(index).includes('idx_lobby_comments_parent')
			);
			app.save(comments);
		} catch {
			// already gone
		}
	}
);
