/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
	try {
		app.findCollectionByNameOrId('match_filter_snapshots');
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
		name: 'match_filter_snapshots',
		type: 'base',
		fields: [
			{
				autogeneratePattern: '',
				hidden: false,
				id: 'text_snapshot_id',
				max: 50,
				min: 1,
				name: 'id',
				pattern: '^[a-z0-9:_-]+$',
				presentable: false,
				primaryKey: true,
				required: true,
				system: true,
				type: 'text'
			},
			{
				hidden: false,
				id: 'json_snapshot_maps',
				maxSize: 500000,
				name: 'maps',
				presentable: false,
				required: false,
				system: false,
				type: 'json'
			},
			{
				hidden: false,
				id: 'json_snapshot_players',
				maxSize: 5000000,
				name: 'players',
				presentable: false,
				required: false,
				system: false,
				type: 'json'
			}
		],
		indexes: []
	});

	app.save(collection);

	const record = new Record(collection);
	record.set('id', 'community');
	record.set('maps', []);
	record.set('players', []);
	app.save(record);
}, (app) => {
	const collection = app.findCollectionByNameOrId('match_filter_snapshots');
	return app.delete(collection);
});
