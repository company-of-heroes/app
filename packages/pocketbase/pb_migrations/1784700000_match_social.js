/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');

		if (!lobbies.fields.getByName('likeCount')) {
			lobbies.fields.add(
				new NumberField({
					hidden: false,
					id: 'number_lobby_like_count',
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

		if (!lobbies.fields.getByName('downloadCount')) {
			lobbies.fields.add(
				new NumberField({
					hidden: false,
					id: 'number_lobby_download_count',
					max: null,
					min: 0,
					name: 'downloadCount',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		if (!lobbies.fields.getByName('commentCount')) {
			lobbies.fields.add(
				new NumberField({
					hidden: false,
					id: 'number_lobby_comment_count',
					max: null,
					min: 0,
					name: 'commentCount',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		app.save(lobbies);

		try {
			app.findCollectionByNameOrId('lobby_likes');
		} catch {
			const likes = new Collection({
				createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
				deleteRule: 'user = @request.auth.id',
				listRule: '',
				viewRule: '',
				updateRule: null,
				name: 'lobby_likes',
				type: 'base',
				id: 'pbc_5728193041',
				indexes: [
					'CREATE UNIQUE INDEX `idx_lobby_likes_lobby_user` ON `lobby_likes` (`lobby`, `user`)',
					'CREATE INDEX `idx_lobby_likes_lobby` ON `lobby_likes` (`lobby`)'
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
						collectionId: 'pbc_1574334436',
						hidden: false,
						id: 'relation_lobby_likes_lobby',
						maxSelect: 1,
						minSelect: 1,
						name: 'lobby',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						cascadeDelete: true,
						collectionId: '_pb_users_auth_',
						hidden: false,
						id: 'relation_lobby_likes_user',
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
						id: 'autodate_lobby_likes_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_lobby_likes_updated',
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

		try {
			app.findCollectionByNameOrId('lobby_comments');
		} catch {
			const comments = new Collection({
				createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
				deleteRule:
					'user = @request.auth.id || @request.auth.role = "admin" || @request.auth.role = "moderator"',
				listRule: '',
				viewRule: '',
				updateRule:
					'user = @request.auth.id || @request.auth.role = "admin" || @request.auth.role = "moderator"',
				name: 'lobby_comments',
				type: 'base',
				id: 'pbc_5728193042',
				indexes: ['CREATE INDEX `idx_lobby_comments_lobby` ON `lobby_comments` (`lobby`)'],
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
						collectionId: 'pbc_1574334436',
						hidden: false,
						id: 'relation_lobby_comments_lobby',
						maxSelect: 1,
						minSelect: 1,
						name: 'lobby',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						cascadeDelete: false,
						collectionId: '_pb_users_auth_',
						hidden: false,
						id: 'relation_lobby_comments_user',
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
						id: 'text_lobby_comments_text',
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
						id: 'autodate_lobby_comments_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_lobby_comments_updated',
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
		}

		try {
			app.findCollectionByNameOrId('lobby_downloads');
		} catch {
			const downloads = new Collection({
				createRule: null,
				deleteRule: null,
				listRule: null,
				viewRule: null,
				updateRule: null,
				name: 'lobby_downloads',
				type: 'base',
				id: 'pbc_5728193043',
				indexes: [
					'CREATE UNIQUE INDEX `idx_lobby_downloads_lobby_user` ON `lobby_downloads` (`lobby`, `user`)',
					'CREATE INDEX `idx_lobby_downloads_lobby` ON `lobby_downloads` (`lobby`)'
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
						collectionId: 'pbc_1574334436',
						hidden: false,
						id: 'relation_lobby_downloads_lobby',
						maxSelect: 1,
						minSelect: 1,
						name: 'lobby',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						cascadeDelete: true,
						collectionId: '_pb_users_auth_',
						hidden: false,
						id: 'relation_lobby_downloads_user',
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
						id: 'autodate_lobby_downloads_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_lobby_downloads_updated',
						name: 'updated',
						onCreate: true,
						onUpdate: true,
						presentable: false,
						system: false,
						type: 'autodate'
					}
				]
			});
			app.save(downloads);
		}
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('lobby_downloads'));
		} catch {
			// already gone
		}

		try {
			app.delete(app.findCollectionByNameOrId('lobby_comments'));
		} catch {
			// already gone
		}

		try {
			app.delete(app.findCollectionByNameOrId('lobby_likes'));
		} catch {
			// already gone
		}

		const lobbies = app.findCollectionByNameOrId('lobbies');

		if (lobbies.fields.getByName('commentCount')) {
			lobbies.fields.removeByName('commentCount');
		}

		if (lobbies.fields.getByName('downloadCount')) {
			lobbies.fields.removeByName('downloadCount');
		}

		if (lobbies.fields.getByName('likeCount')) {
			lobbies.fields.removeByName('likeCount');
		}

		app.save(lobbies);
	}
);
