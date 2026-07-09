/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
	const collection = app.findCollectionByNameOrId('match_filter_snapshots');

	if (!collection.fields.getByName('matchCount')) {
		collection.fields.add(
			new NumberField({
				hidden: false,
				id: 'number_match_count',
				max: null,
				min: 0,
				name: 'matchCount',
				onlyInt: true,
				presentable: false,
				required: false,
				system: false
			})
		);
	}

	app.save(collection);

	try {
		const countRow = new DynamicModel({ total: 0 });
		app
			.db()
			.newQuery(
				`SELECT COUNT(*) AS total
         FROM lobbies
         WHERE needsResult = 0
           AND title != 'Skirmish'
           AND replay != ''`
			)
			.one(countRow);

		const record = app.findRecordById('match_filter_snapshots', 'community');
		record.set('matchCount', Number(countRow.total) || 0);
		app.save(record);
	} catch {
		// snapshot not ready yet
	}
}, (app) => {
	const collection = app.findCollectionByNameOrId('match_filter_snapshots');

	if (collection.fields.getByName('matchCount')) {
		collection.fields.removeByName('matchCount');
	}

	app.save(collection);
});
