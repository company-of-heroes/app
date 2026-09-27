/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('player_customizations');
			return;
		} catch {
			// create below
		}

		const collection = new Collection({
			createRule: null,
			deleteRule: null,
			listRule: '',
			viewRule: '',
			updateRule: null,
			name: 'player_customizations',
			type: 'base',
			id: 'pbc_player_custom',
			indexes: [
				'CREATE UNIQUE INDEX `idx_player_customizations_steam` ON `player_customizations` (`steam_id`)'
			],
			fields: [
				{
					autogeneratePattern: '[a-z0-9]{15}',
					hidden: false,
					id: 'text_player_custom_id',
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
					autogeneratePattern: '',
					hidden: false,
					id: 'text_player_custom_steam_id',
					max: 32,
					min: 0,
					name: 'steam_id',
					pattern: '',
					presentable: true,
					primaryKey: false,
					required: true,
					system: false,
					type: 'text'
				},
				{
					cascadeDelete: true,
					collectionId: '_pb_users_auth_',
					hidden: false,
					id: 'relation_player_custom_user',
					maxSelect: 1,
					minSelect: 0,
					name: 'user',
					presentable: false,
					required: true,
					system: false,
					type: 'relation'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text_player_custom_bio',
					max: 500,
					min: 0,
					name: 'bio',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					hidden: false,
					id: 'json_player_custom_links',
					maxSize: 8000,
					name: 'links',
					presentable: false,
					required: false,
					system: false,
					type: 'json'
				},
				{
					hidden: false,
					id: 'file_player_custom_background',
					maxSelect: 1,
					maxSize: 5242880,
					mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
					name: 'background',
					presentable: false,
					protected: false,
					required: false,
					system: false,
					thumbs: ['800x0', '1600x0'],
					type: 'file'
				},
				{
					hidden: false,
					id: 'autodate_player_custom_created',
					name: 'created',
					onCreate: true,
					onUpdate: false,
					presentable: false,
					system: false,
					type: 'autodate'
				},
				{
					hidden: false,
					id: 'autodate_player_custom_updated',
					name: 'updated',
					onCreate: true,
					onUpdate: true,
					presentable: false,
					system: false,
					type: 'autodate'
				}
			]
		});

		app.save(collection);
	},
	(app) => {
		try {
			const collection = app.findCollectionByNameOrId('player_customizations');
			app.delete(collection);
		} catch {
			// already removed
		}
	}
);
