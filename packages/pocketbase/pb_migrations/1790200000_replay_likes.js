/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const replays = app.findCollectionByNameOrId('replays');
		const likeCount = replays.fields.getByName('likeCount');
		if (likeCount) {
			likeCount.min = null;
			app.save(replays);
		}

		try {
			app.findCollectionByNameOrId('replay_likes');
		} catch {
			const likes = new Collection({
				createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
				deleteRule: 'user = @request.auth.id',
				listRule: '',
				viewRule: '',
				updateRule: 'user = @request.auth.id',
				name: 'replay_likes',
				type: 'base',
				id: 'pbc_5728193052',
				indexes: [
					'CREATE UNIQUE INDEX `idx_replay_likes_replay_user` ON `replay_likes` (`replay`, `user`)',
					'CREATE INDEX `idx_replay_likes_replay` ON `replay_likes` (`replay`)'
				],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: 'text_replay_likes_id',
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
						collectionId: 'pbc_3644265509',
						hidden: false,
						id: 'relation_replay_likes_replay',
						maxSelect: 1,
						minSelect: 1,
						name: 'replay',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						cascadeDelete: true,
						collectionId: '_pb_users_auth_',
						hidden: false,
						id: 'relation_replay_likes_user',
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
						id: 'number_replay_likes_value',
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
						id: 'autodate_replay_likes_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_replay_likes_updated',
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
			app.delete(app.findCollectionByNameOrId('replay_likes'));
		} catch {
			// already gone
		}

		try {
			const replays = app.findCollectionByNameOrId('replays');
			const likeCount = replays.fields.getByName('likeCount');
			if (likeCount) {
				likeCount.min = 0;
				app.save(replays);
			}
		} catch {
			// already gone
		}
	}
);
