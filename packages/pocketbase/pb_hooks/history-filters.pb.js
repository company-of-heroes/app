/// <reference path="../pb_data/types.d.ts" />

'use strict';

/**
 * User-scoped history search must use the authenticated account.
 * Query userId is ignored so callers cannot enumerate another user's play graph.
 */
function resolveHistoryUserId(e, scope) {
	if (scope !== 'user') {
		return { userId: '' };
	}

	if (!e.auth || !e.auth.id) {
		return { error: e.json(401, { message: 'Unauthorized' }) };
	}

	return { userId: String(e.auth.id) };
}

routerAdd('GET', '/api/history-players', (e) => {
	const { loadUserSteamIds, userPlayedLobbyClause } = require(`${__hooks}/lib/match-history.js`);
	const query = e.request.url.query();
	const scope = query.get('scope') || 'user';
	const resolved = resolveHistoryUserId(e, scope);
	if (resolved.error) {
		return resolved.error;
	}

	const userId = resolved.userId;
	const q = (query.get('q') || '').trim();
	const limit = Math.min(50, Math.max(1, parseInt(query.get('limit') || '20', 10) || 20));

	const bindings = {
		like: `%${q}%`,
		limit
	};

	const searchClause =
		q.length === 0
			? '1 = 1'
			: `(p.alias LIKE {:like} OR CAST(p.profile_id AS TEXT) LIKE {:like})`;

	let sql;
	if (scope === 'community') {
		sql = `SELECT p.profile_id AS profile_id, COALESCE(p.alias, '') AS alias
       FROM players p
       WHERE ${searchClause}
       ORDER BY p.alias ASC, p.profile_id ASC
       LIMIT {:limit}`;
	} else {
		bindings.userId = userId;
		const played = userPlayedLobbyClause(
			'l',
			{ steamIds: loadUserSteamIds(userId) },
			bindings
		);
		sql = `SELECT DISTINCT p.profile_id AS profile_id, COALESCE(p.alias, '') AS alias
       FROM players p
       INNER JOIN lobby_player_index i ON i.profile_id = p.profile_id
       INNER JOIN lobbies l ON l.id = i.lobby
       WHERE ${played}
         AND l.needsResult = 0
         AND l.title != 'Skirmish'
         AND ${searchClause}
       ORDER BY p.alias ASC, p.profile_id ASC
       LIMIT {:limit}`;
	}

	try {
		const rows = arrayOf(new DynamicModel({ profile_id: 0, alias: '' }));
		$app.db().newQuery(sql).bind(bindings).all(rows);
		return e.json(200, {
			items: rows.map((row) => ({
				profile_id: Number(row.profile_id),
				alias: row.alias || ''
			}))
		});
	} catch (error) {
		return e.json(400, { message: String(error?.message || error) });
	}
});

routerAdd('GET', '/api/history-maps', (e) => {
	const { loadUserSteamIds, userPlayedLobbyClause } = require(`${__hooks}/lib/match-history.js`);
	const query = e.request.url.query();
	const scope = query.get('scope') || 'user';
	const resolved = resolveHistoryUserId(e, scope);
	if (resolved.error) {
		return resolved.error;
	}

	const userId = resolved.userId;
	const q = (query.get('q') || '').trim();
	const limit = Math.min(200, Math.max(1, parseInt(query.get('limit') || '100', 10) || 100));

	const bindings = {
		like: `%${q}%`,
		limit
	};

	const searchClause =
		q.length === 0 ? '1 = 1' : `(m.name LIKE {:like} OR m.map LIKE {:like})`;

	let sql;
	if (scope === 'community') {
		sql = `SELECT m.map AS map, COALESCE(NULLIF(m.name, ''), m.map) AS name
       FROM maps m
       WHERE ${searchClause}
       ORDER BY m.name ASC, m.map ASC
       LIMIT {:limit}`;
	} else {
		bindings.userId = userId;
		const played = userPlayedLobbyClause(
			'l',
			{ steamIds: loadUserSteamIds(userId) },
			bindings
		);
		sql = `SELECT DISTINCT m.map AS map, COALESCE(NULLIF(m.name, ''), m.map) AS name
       FROM maps m
       INNER JOIN lobbies l ON l.map = m.map
       WHERE ${played}
         AND l.needsResult = 0
         AND l.title != 'Skirmish'
         AND ${searchClause}
       ORDER BY m.name ASC, m.map ASC
       LIMIT {:limit}`;
	}

	try {
		const rows = arrayOf(new DynamicModel({ map: '', name: '' }));
		$app.db().newQuery(sql).bind(bindings).all(rows);

		if (rows.length === 0) {
			const fallbackBindings = { like: `%${q}%`, limit };
			let fallbackSql = `SELECT DISTINCT l.map AS map, l.map AS name
         FROM lobbies l
         WHERE l.map IS NOT NULL AND l.map != ''
           AND l.needsResult = 0 AND l.title != 'Skirmish'`;
			if (scope === 'user') {
				fallbackBindings.userId = userId;
				fallbackSql += ` AND ${userPlayedLobbyClause(
					'l',
					{ steamIds: loadUserSteamIds(userId) },
					fallbackBindings
				)}`;
			} else {
				fallbackSql += " AND (l.hasReplay = 1 OR (l.replay IS NOT NULL AND l.replay != ''))";
			}
			if (q.length > 0) {
				fallbackSql += ' AND l.map LIKE {:like}';
			}
			fallbackSql += ' ORDER BY l.map ASC LIMIT {:limit}';
			$app.db().newQuery(fallbackSql).bind(fallbackBindings).all(rows);
		}

		return e.json(200, {
			items: rows.map((row) => ({
				map: row.map,
				name: row.name || row.map
			}))
		});
	} catch (error) {
		return e.json(400, { message: String(error?.message || error) });
	}
});
