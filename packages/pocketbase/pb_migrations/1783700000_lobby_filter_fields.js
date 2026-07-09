/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
	const collection = app.findCollectionByNameOrId('pbc_1574334436');

	if (!collection.fields.getByName('playerProfileIdsCsv')) {
		collection.fields.add(new Field({
			autogeneratePattern: '',
			hidden: false,
			id: 'text_lobby_player_ids_csv',
			max: 500,
			min: 0,
			name: 'playerProfileIdsCsv',
			pattern: '',
			presentable: false,
			primaryKey: false,
			required: false,
			system: false,
			type: 'text'
		}));
	}

	if (!collection.fields.getByName('lobbyPlayers')) {
		collection.fields.add(new Field({
			hidden: false,
			id: 'json_lobby_players',
			maxSize: 10000,
			name: 'lobbyPlayers',
			presentable: false,
			required: false,
			system: false,
			type: 'json'
		}));
	}

	return app.save(collection);
}, (app) => {
	const collection = app.findCollectionByNameOrId('pbc_1574334436');

	if (collection.fields.getByName('lobbyPlayers')) {
		collection.fields.removeByName('lobbyPlayers');
	}

	if (collection.fields.getByName('playerProfileIdsCsv')) {
		collection.fields.removeByName('playerProfileIdsCsv');
	}

	return app.save(collection);
});
