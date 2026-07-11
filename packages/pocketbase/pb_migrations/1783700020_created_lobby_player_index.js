/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
	try {
		app.findCollectionByNameOrId('lobby_player_index');
		return;
	} catch {
		// create below
	}

	const collection = new Collection({
		createRule: null,
		deleteRule: null,
		listRule: null,
		viewRule: null,
		updateRule: null,
		name: 'lobby_player_index',
		type: 'base',
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
				id: 'relation_lobby_player_index_lobby',
				maxSelect: 1,
				minSelect: 1,
				name: 'lobby',
				presentable: false,
				required: true,
				system: false,
				type: 'relation'
			},
			{
				hidden: false,
				id: 'number_lobby_player_index_profile',
				max: null,
				min: null,
				name: 'profile_id',
				onlyInt: true,
				presentable: false,
				required: true,
				system: false,
				type: 'number'
			}
		],
		indexes: [
			'CREATE UNIQUE INDEX `idx_lobby_player_index_lobby_profile` ON `lobby_player_index` (`lobby`, `profile_id`)',
			'CREATE INDEX `idx_lobby_player_index_profile` ON `lobby_player_index` (`profile_id`)'
		]
	});

	return app.save(collection);
}, (app) => {
	const collection = app.findCollectionByNameOrId('lobby_player_index');
	return app.delete(collection);
});
