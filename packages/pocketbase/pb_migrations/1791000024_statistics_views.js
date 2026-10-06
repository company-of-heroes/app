/// <reference path="../pb_data/types.d.ts" />

// Read models for the website's community statistics. Listing `lobby_player_index` with
// `expand=lobby` took ~1 s per 500 rows (PocketBase loads whole lobby rows, players JSON
// included); these views select only the columns the statistics need, one row per match,
// and the website reads them in parallel ranges of ids (~10 ms of SQL each). Superusers only.

migrate(
	(app) => {
		app.save(
			new Collection({
				type: 'view',
				name: 'statistics_matches',
				listRule: null,
				viewRule: null,
				// One row per lobby; players as [profile_id, race_id, outcome, alias]. A filter on id
				// is pushed into the GROUP BY, so a range of ids reads only those lobbies.
				viewQuery: `SELECT l.id, l.createdAt, l.durationSeconds, l.title,
					MAX(i.session_id) AS session_id, CAST(MAX(i.map) AS TEXT) AS map,
					MAX(i.matchtype_id) AS matchtype_id,
					json_group_array(json_array(i.profile_id, i.race_id, i.outcome, i.alias)) AS players
					FROM lobbies l JOIN lobby_player_index i ON i.lobby = l.id
					WHERE l.needsResult = 0 AND l.isHidden = 0 AND i.session_id > 0
					  AND i.outcome IN (0, 1) AND i.matchtype_id IN (0, 1, 2, 3, 4, 5, 6, 7, 14)
					GROUP BY l.id`
			})
		);
		app.save(
			new Collection({
				type: 'view',
				name: 'statistics_replays',
				listRule: null,
				viewRule: null,
				viewQuery: `SELECT id, replayStats FROM lobbies
					WHERE isHidden = 0 AND replayStats IS NOT NULL AND replayStats != 'null'`
			})
		);
	},
	(app) => {
		for (const name of ['statistics_replays', 'statistics_matches']) {
			try {
				app.delete(app.findCollectionByNameOrId(name));
			} catch {
				// already gone
			}
		}
	}
);
