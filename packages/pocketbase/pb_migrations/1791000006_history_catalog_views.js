/// <reference path="../pb_data/types.d.ts" />

// History filter catalogs as views over the real data. The `players` / `maps`
// tables filled by hooks and backfills had drifted (2731 of 3260 players, 83 of
// 93 maps). Player names come from a new lobby_player_index.alias, filled from
// the lobby's player summaries (or its result when those are missing);
// pb_hooks/lib/lobby-columns.js keeps it filled on writes.

const FINISHED = "needsResult = 0 AND title != 'Skirmish' AND map != ''";

migrate(
	(app) => {
		const index = app.findCollectionByNameOrId('lobby_player_index');
		index.fields.add(new TextField({ name: 'alias', max: 200 }));
		index.indexes.push('CREATE INDEX `idx_lpi_alias` ON `lobby_player_index` (`alias`)');
		app.save(index);

		app
			.db()
			.newQuery(
				`UPDATE lobby_player_index SET alias = COALESCE((
					SELECT NULLIF(TRIM(COALESCE(json_extract(p.value, '$.alias'), json_extract(p.value, '$.profile.alias'))), '')
					FROM lobbies l, json_each(CASE WHEN json_valid(l.lobbyPlayers) THEN l.lobbyPlayers ELSE '[]' END) p
					WHERE l.id = lobby_player_index.lobby
					  AND CAST(COALESCE(json_extract(p.value, '$.profile_id'), json_extract(p.value, '$.profile.profile_id')) AS INTEGER) = lobby_player_index.profile_id
					LIMIT 1
				), (
					SELECT NULLIF(TRIM(json_extract(p.value, '$.alias')), '')
					FROM lobbies l, json_each(CASE WHEN json_valid(l.result) AND json_type(json_extract(l.result, '$.players')) = 'array'
						THEN json_extract(l.result, '$.players') ELSE '[]' END) p
					WHERE l.id = lobby_player_index.lobby
					  AND CAST(json_extract(p.value, '$.profile_id') AS INTEGER) = lobby_player_index.profile_id
					LIMIT 1
				), '')`
			)
			.execute();

		// `counts` (finished, not Skirmish) was stale on ~8k rows; with it correct, the
		// user's maps/players read the index alone instead of joining lobbies.
		app
			.db()
			.newQuery(
				"UPDATE lobby_player_index SET counts = (SELECT l.needsResult = 0 AND l.title != 'Skirmish' FROM lobbies l WHERE l.id = lobby_player_index.lobby)"
			)
			.execute();

		// Covers the history_maps view: 1ms instead of reading every lobby row.
		const lobbies = app.findCollectionByNameOrId('lobbies');
		lobbies.indexes.push(
			'CREATE INDEX `idx_lobbies_map_finished` ON `lobbies` (`map`, `needsResult`, `title`)'
		);
		app.save(lobbies);
		app.db().newQuery('ANALYZE lobbies').execute();
		app.db().newQuery('ANALYZE lobby_player_index').execute();

		app.save(
			new Collection({
				type: 'view',
				name: 'history_maps',
				listRule: '',
				viewRule: '',
				viewQuery: `SELECT map AS id, map FROM lobbies WHERE ${FINISHED} GROUP BY map`
			})
		);
		app.save(
			new Collection({
				type: 'view',
				name: 'history_players',
				listRule: '',
				viewRule: '',
				// `alias` is the name in the player's latest game; `aliases` lists every name
				// they played under, so searching an old name still finds them.
				// CAST AS TEXT: otherwise PocketBase types these columns as JSON and the
				// response fails on names that are not valid JSON (quotes, backslashes).
				viewQuery: `SELECT CAST(i.profile_id AS TEXT) AS id, i.profile_id,
					CAST((SELECT i2.alias FROM lobby_player_index i2 JOIN lobbies l2 ON l2.id = i2.lobby
						WHERE i2.profile_id = i.profile_id AND i2.alias != '' ORDER BY l2.createdAt DESC LIMIT 1) AS TEXT) AS alias,
					CAST(GROUP_CONCAT(DISTINCT i.alias) AS TEXT) AS aliases
					FROM lobby_player_index i WHERE i.alias != '' GROUP BY i.profile_id`
			})
		);
	},
	(app) => {
		for (const name of ['history_maps', 'history_players']) {
			try {
				app.delete(app.findCollectionByNameOrId(name));
			} catch {
				// already removed
			}
		}
		const lobbies = app.findCollectionByNameOrId('lobbies');
		lobbies.indexes = lobbies.indexes.filter((idx) => !idx.includes('`idx_lobbies_map_finished`'));
		app.save(lobbies);
		const index = app.findCollectionByNameOrId('lobby_player_index');
		index.fields.removeByName('alias');
		index.indexes = index.indexes.filter((idx) => !idx.includes('`idx_lpi_alias`'));
		app.save(index);
	}
);
