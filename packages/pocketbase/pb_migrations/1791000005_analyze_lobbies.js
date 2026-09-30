/// <reference path="../pb_data/types.d.ts" />

// Refresh SQLite planner statistics after the new lobby indexes. Without stats the
// planner treats the new indexes as highly selective and picks one that forces a
// full-row sort: community history went from ~30ms to 5-10s on the local copy.
// Full ANALYZE takes a few seconds on these tables; it runs once.
migrate((app) => {
	app.db().newQuery('ANALYZE lobbies').execute();
	app.db().newQuery('ANALYZE lobby_player_index').execute();
});
