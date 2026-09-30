/// <reference path="../pb_data/types.d.ts" />

// replay_aggregation is unused (only referenced by generated app types) and
// scans every replay's players JSON on read.
migrate(
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('replay_aggregation'));
		} catch {
			// already removed
		}
	},
	(app) => {
		const collection = new Collection({
			type: 'view',
			name: 'replay_aggregation',
			listRule: null,
			viewRule: null,
			viewQuery:
				"SELECT p.createdBy AS id, p.createdBy AS user, p.players, m.maps FROM (SELECT sub.createdBy, json_group_array(json(sub.value)) AS players FROM (SELECT DISTINCT r.createdBy, player.value FROM replays r, json_each(r.players) AS player WHERE r.createdBy != '') AS sub GROUP BY sub.createdBy) AS p LEFT JOIN (SELECT sub.createdBy, json_group_array(sub.mapName) AS maps FROM (SELECT DISTINCT createdBy, mapName FROM replays WHERE createdBy != '') AS sub GROUP BY sub.createdBy) AS m ON p.createdBy = m.createdBy"
		});
		app.save(collection);
	}
);
