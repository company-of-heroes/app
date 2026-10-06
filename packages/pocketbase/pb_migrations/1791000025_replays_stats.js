/// <reference path="../pb_data/types.d.ts" />

// Uploaded replays (member uploads and personal libraries) in the community statistics, as
// anonymous totals only. `replays.replayStats` is filled by the website's `replay-stats` job;
// `statistics_uploads` reads it with the few columns needed to tell the mode and to drop
// copies of games already counted. `statistics_matches` now also returns `memberReplay`, so
// a replay published from a lobby is not counted twice. Schema only.

const MATCHES_QUERY = `SELECT l.id, l.createdAt, l.durationSeconds, l.title, l.memberReplay,
	MAX(i.session_id) AS session_id, CAST(MAX(i.map) AS TEXT) AS map,
	MAX(i.matchtype_id) AS matchtype_id,
	json_group_array(json_array(i.profile_id, i.race_id, i.outcome, i.alias)) AS players
	FROM lobbies l JOIN lobby_player_index i ON i.lobby = l.id
	WHERE l.needsResult = 0 AND l.isHidden = 0 AND i.session_id > 0
	  AND i.outcome IN (0, 1) AND i.matchtype_id IN (0, 1, 2, 3, 4, 5, 6, 7, 14)
	GROUP BY l.id`;

migrate(
	(app) => {
		const replays = app.findCollectionByNameOrId('replays');
		if (!replays.fields.getByName('replayStats')) {
			replays.fields.add(
				new Field({
					hidden: false,
					id: 'json_replays_replay_stats',
					maxSize: 20000,
					name: 'replayStats',
					presentable: false,
					required: false,
					system: false,
					type: 'json'
				})
			);
			app.save(replays);
		}

		const matches = app.findCollectionByNameOrId('statistics_matches');
		matches.viewQuery = MATCHES_QUERY;
		app.save(matches);

		// Small rows: what the mode and the duplicate check need (human names, the summary's
		// races, the AI flag). The full summaries come from statistics_upload_replays.
		app.save(
			new Collection({
				type: 'view',
				name: 'statistics_uploads',
				listRule: null,
				viewRule: null,
				viewQuery: `SELECT r.id, r.gameDate, r.createdAt, r.mapFilename, r.durationInSeconds, r.isRanked,
					IFNULL(json_extract(r.replayStats, '$.ai'), 0) AS ai,
					(SELECT json_group_array(COALESCE(NULLIF(json_extract(p.value, '$.name'), ''), json_extract(p.value, '$.alias'), ''))
						FROM json_each(CASE WHEN json_valid(r.players) THEN r.players ELSE '[]' END) p
						WHERE COALESCE(json_extract(p.value, '$.dataInfo1'), 0) NOT IN (1, 3)
						  AND COALESCE(json_extract(p.value, '$.name'), '') NOT LIKE 'CPU - %') AS names,
					(SELECT json_group_array(json_extract(s.value, '$.race'))
						FROM json_each(r.replayStats, '$.players') s) AS races
					FROM replays r
					WHERE r.visibility != 'deleted' AND r.replayStats IS NOT NULL AND r.replayStats != 'null'`
			})
		);
		app.save(
			new Collection({
				type: 'view',
				name: 'statistics_upload_replays',
				listRule: null,
				viewRule: null,
				viewQuery: `SELECT id, replayStats FROM replays
					WHERE visibility != 'deleted' AND replayStats IS NOT NULL AND replayStats != 'null'`
			})
		);
	},
	(app) => {
		for (const name of ['statistics_upload_replays', 'statistics_uploads']) {
			try {
				app.delete(app.findCollectionByNameOrId(name));
			} catch {
				// already gone
			}
		}

		const matches = app.findCollectionByNameOrId('statistics_matches');
		matches.viewQuery = MATCHES_QUERY.replace(' l.memberReplay,', '');
		app.save(matches);

		const replays = app.findCollectionByNameOrId('replays');
		if (replays.fields.getByName('replayStats')) {
			replays.fields.removeByName('replayStats');
			app.save(replays);
		}
	}
);
