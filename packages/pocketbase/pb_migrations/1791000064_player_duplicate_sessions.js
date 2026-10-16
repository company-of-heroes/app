/// <reference path="../pb_data/types.d.ts" />

// Relic sessions a Steam id has more than one counted, finished row in (one match recorded
// in two lobbies, until the lobby-merge job runs), for the match reward metrics: they count
// rows and subtract these. A view: nothing is copied or backfilled. Always queried with a
// steam_id filter, which SQLite pushes into the GROUP BY (idx_lobby_player_index_steam).
// steam_id and session_id stay plain columns (not CAST) so that filter keeps the index.
migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('player_duplicate_sessions');
			return;
		} catch {
			// create below
		}

		app.save(
			new Collection({
				type: 'view',
				name: 'player_duplicate_sessions',
				listRule: null,
				viewRule: null,
				viewQuery: `SELECT MIN(i.id) AS id, i.steam_id, i.session_id
					FROM lobby_player_index i
					WHERE i.counts = 1 AND i.session_id > 0 AND i.outcome IN (0, 1) AND i.steam_id != ''
					GROUP BY i.steam_id, i.session_id
					HAVING COUNT(*) > 1`
			})
		);
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('player_duplicate_sessions'));
		} catch {
			// already removed
		}
	}
);
