/// <reference path="../pb_data/types.d.ts" />

// lobby_player_index.elo / .slot were left at 0 for many rows (about 7.8k elo gaps,
// mostly 2026-09-01..17). Match history compensated with per-query JSON subqueries;
// filling the columns lets it filter on them directly. Same sources as that fallback:
// elo = result.players[].oldrating (else newrating), slot = players[].slot + 1.
// pb_hooks/lib/lobby-columns.js applies the same fill per lobby on every write.

const RESULT_PLAYERS = `(SELECT CASE WHEN json_valid(l.result) AND json_type(json_extract(l.result, '$.players')) = 'array'
	THEN json_extract(l.result, '$.players') ELSE '[]' END FROM lobbies l WHERE l.id = lobby_player_index.lobby)`;
const LOBBY_PLAYERS = `(SELECT CASE WHEN json_valid(l.players) THEN l.players ELSE '[]' END FROM lobbies l WHERE l.id = lobby_player_index.lobby)`;

migrate((app) => {
	app
		.db()
		.newQuery(
			`UPDATE lobby_player_index SET elo = (
				SELECT COALESCE(NULLIF(CAST(json_extract(p.value, '$.oldrating') AS INTEGER), 0), NULLIF(CAST(json_extract(p.value, '$.newrating') AS INTEGER), 0))
				FROM json_each(${RESULT_PLAYERS}) p
				WHERE CAST(json_extract(p.value, '$.profile_id') AS INTEGER) = lobby_player_index.profile_id
				LIMIT 1
			)
			WHERE COALESCE(elo, 0) = 0 AND EXISTS (
				SELECT 1 FROM json_each(${RESULT_PLAYERS}) p
				WHERE CAST(json_extract(p.value, '$.profile_id') AS INTEGER) = lobby_player_index.profile_id
				  AND COALESCE(NULLIF(CAST(json_extract(p.value, '$.oldrating') AS INTEGER), 0), NULLIF(CAST(json_extract(p.value, '$.newrating') AS INTEGER), 0)) IS NOT NULL
			)`
		)
		.execute();

	app
		.db()
		.newQuery(
			`UPDATE lobby_player_index SET slot = (
				SELECT CAST(json_extract(p.value, '$.slot') AS INTEGER) + 1
				FROM json_each(${LOBBY_PLAYERS}) p
				WHERE CAST(COALESCE(json_extract(p.value, '$.playerId'), json_extract(p.value, '$.profile.profile_id'), json_extract(p.value, '$.profile_id')) AS INTEGER) = lobby_player_index.profile_id
				  AND json_extract(p.value, '$.slot') IS NOT NULL
				LIMIT 1
			)
			WHERE COALESCE(slot, 0) = 0 AND EXISTS (
				SELECT 1 FROM json_each(${LOBBY_PLAYERS}) p
				WHERE CAST(COALESCE(json_extract(p.value, '$.playerId'), json_extract(p.value, '$.profile.profile_id'), json_extract(p.value, '$.profile_id')) AS INTEGER) = lobby_player_index.profile_id
				  AND json_extract(p.value, '$.slot') IS NOT NULL
			)`
		)
		.execute();
});
