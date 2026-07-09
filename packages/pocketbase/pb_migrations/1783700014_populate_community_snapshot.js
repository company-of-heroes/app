/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
	const mapRows = arrayOf(new DynamicModel({ value: '' }));
	app
		.db()
		.newQuery(
			`SELECT DISTINCT map AS value
     FROM lobbies
     WHERE needsResult = 0
       AND title != 'Skirmish'
       AND replay != ''
       AND map IS NOT NULL
     ORDER BY value`
		)
		.all(mapRows);

	const playerRows = arrayOf(new DynamicModel({ profile_id: '', alias: '' }));
	app
		.db()
		.newQuery(
			`SELECT DISTINCT
       json_extract(p.value, '$.profile.profile_id') AS profile_id,
       json_extract(p.value, '$.profile.alias') AS alias
     FROM lobbies l, json_each(l.players) AS p
     WHERE l.needsResult = 0
       AND l.title != 'Skirmish'
       AND l.replay != ''
       AND json_extract(p.value, '$.profile.profile_id') IS NOT NULL`
		)
		.all(playerRows);

	const maps = mapRows.map((row) => row.value);
	const players = playerRows.map((row) => ({
		profile_id: Number(row.profile_id),
		alias: row.alias
	}));

	const record = app.findRecordById('match_filter_snapshots', 'community');
	record.set('maps', maps);
	record.set('players', players);
	app.save(record);
}, () => {
	// no-op
});
