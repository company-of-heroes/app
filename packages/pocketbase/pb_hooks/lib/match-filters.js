'use strict';

/** Decode goja byte/char-code arrays without O(n²) string +=. */
function bytesToString(raw) {
	if (!Array.isArray(raw) || raw.length === 0 || typeof raw[0] !== 'number') {
		return '';
	}

	const chunk = 0x8000;
	let text = '';
	for (let i = 0; i < raw.length; i += chunk) {
		text += String.fromCharCode.apply(null, raw.slice(i, i + chunk));
	}

	return text;
}

function parseJsonArray(raw) {
	if (raw == null || raw === '' || raw === '[]' || raw === 'null') {
		return [];
	}

	// goja may expose JSON text as a byte/char-code array
	if (typeof raw !== 'string') {
		if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'number') {
			raw = bytesToString(raw);
		} else if (Array.isArray(raw)) {
			// Already a real JS array of values/objects
			return raw;
		} else {
			try {
				raw = JSON.stringify(raw);
			} catch {
				return [];
			}
		}
	}

	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/** Cached user snapshots built before lobbyPlayers backfill have profile_ids but blank aliases. */
function playersNeedRebuild(players) {
	if (!Array.isArray(players) || players.length === 0) {
		return false;
	}

	return players.every((player) => {
		if (!player || typeof player !== 'object') {
			return true;
		}
		return !String(player.alias ?? '').trim();
	});
}

function buildUserMatchFilters(userId) {
	const { loadUserSteamIds, userPlayedLobbyClause } = require(`${__hooks}/lib/match-history.js`);
	const bindings = { userId };
	const played = userPlayedLobbyClause('l', { steamIds: loadUserSteamIds(userId) }, bindings);
	const lobbyWhere = `l.needsResult = 0 AND l.title != 'Skirmish' AND ${played}`;

	const mapRows = arrayOf(new DynamicModel({ value: '' }));
	$app
		.db()
		.newQuery(
			`SELECT DISTINCT l.map AS value
       FROM lobbies l
       WHERE ${lobbyWhere}
         AND l.map IS NOT NULL
       ORDER BY value`
		)
		.bind(bindings)
		.all(mapRows);

	// Prefer lobbyPlayers summaries; fall back to nested players.profile when lobbyPlayers is empty.
	const playerRows = arrayOf(new DynamicModel({ profile_id: 0, alias: '' }));
	$app
		.db()
		.newQuery(
			`SELECT
         i.profile_id AS profile_id,
         MAX(COALESCE(
           NULLIF(json_extract(lp.value, '$.alias'), ''),
           NULLIF(json_extract(lp.value, '$.profile.alias'), ''),
           NULLIF(json_extract(raw.value, '$.profile.alias'), ''),
           NULLIF(json_extract(res.value, '$.alias'), ''),
           ''
         )) AS alias
       FROM lobby_player_index i
       INNER JOIN lobbies l ON l.id = i.lobby
       LEFT JOIN json_each(
         CASE
           WHEN l.lobbyPlayers IS NOT NULL AND l.lobbyPlayers != '[]' AND l.lobbyPlayers != '' THEN l.lobbyPlayers
           ELSE '[]'
         END
       ) AS lp ON CAST(COALESCE(
         json_extract(lp.value, '$.profile_id'),
         json_extract(lp.value, '$.profile.profile_id')
       ) AS INTEGER) = i.profile_id
       LEFT JOIN json_each(
         CASE
           WHEN l.players IS NOT NULL AND l.players != '[]' AND l.players != '' THEN l.players
           ELSE '[]'
         END
       ) AS raw ON CAST(json_extract(raw.value, '$.profile.profile_id') AS INTEGER) = i.profile_id
       LEFT JOIN json_each(
         CASE
           WHEN l.result IS NOT NULL AND l.result != ''
                AND json_valid(l.result)
                AND json_type(json_extract(l.result, '$.players')) = 'array'
           THEN json_extract(l.result, '$.players')
           ELSE '[]'
         END
       ) AS res ON CAST(json_extract(res.value, '$.profile_id') AS INTEGER) = i.profile_id
       WHERE ${lobbyWhere}
       GROUP BY i.profile_id
       ORDER BY alias, i.profile_id`
		)
		.bind(bindings)
		.all(playerRows);

	return {
		maps: mapRows.map((row) => row.value).filter(Boolean),
		players: playerRows.map((row) => ({
			profile_id: Number(row.profile_id),
			alias: row.alias || ''
		}))
	};
}

function saveUserMatchFiltersSnapshot(snapshotId, maps, players) {
	try {
		const collection = $app.findCollectionByNameOrId('match_filter_snapshots');
		let snapshot;

		try {
			snapshot = $app.findRecordById('match_filter_snapshots', snapshotId);
			snapshot.set('maps', maps);
			snapshot.set('players', players);
		} catch {
			snapshot = new Record(collection);
			snapshot.set('id', snapshotId);
			snapshot.set('maps', maps);
			snapshot.set('players', players);
		}

		$app.save(snapshot);
	} catch {
		// Snapshot write failed; still return computed filters.
	}
}

module.exports = {
	parseJsonArray,
	playersNeedRebuild,
	buildUserMatchFilters,
	saveUserMatchFiltersSnapshot
};
