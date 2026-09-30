/// <reference path="../pb_data/types.d.ts" />

// Seconds played per Steam id in finished, non-Skirmish matches, for the
// "hours played" reward metric. A view: nothing is copied or backfilled.
migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('player_play_time');
			return;
		} catch {
			// create below
		}

		app.save(
			new Collection({
				type: 'view',
				name: 'player_play_time',
				listRule: null,
				viewRule: null,
				// CAST: otherwise PocketBase types view columns as JSON.
				viewQuery: `SELECT CAST(i.steam_id AS TEXT) AS id,
					CAST(COALESCE(SUM(l.durationSeconds), 0) AS INTEGER) AS seconds
					FROM lobby_player_index i JOIN lobbies l ON l.id = i.lobby
					WHERE i.counts = 1 AND i.session_id > 0 AND i.steam_id != ''
					GROUP BY i.steam_id`
			})
		);
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('player_play_time'));
		} catch {
			// already removed
		}
	}
);
