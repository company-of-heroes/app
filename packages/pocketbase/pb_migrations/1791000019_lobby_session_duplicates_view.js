/// <reference path="../pb_data/types.d.ts" />

// Relic sessions saved as more than one lobby (players starting the same match at
// the same moment); the website's lobby-merge job works through this list. Superusers only.
migrate(
	(app) => {
		const view = new Collection({
			type: 'view',
			name: 'lobby_session_duplicates',
			listRule: null,
			viewRule: null,
			viewQuery: `SELECT CAST(sessionId AS TEXT) AS id, COUNT(*) AS lobbies
				FROM lobbies
				WHERE sessionId > 0
				GROUP BY sessionId
				HAVING COUNT(*) > 1`
		});
		app.save(view);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('lobby_session_duplicates'));
	}
);
