'use strict';

function parseLobbyPlayersField(raw) {
	if (Array.isArray(raw)) {
		return raw;
	}

	if (typeof raw !== 'string' || raw.length === 0) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function summarizePlayersFromLobbyField(lobbyPlayersRaw) {
	const players = [];

	for (const player of lobbyPlayersRaw) {
		const profileId =
			player?.profile_id != null
				? Number(player.profile_id)
				: player?.profile?.profile_id != null
					? Number(player.profile.profile_id)
					: null;

		if (profileId == null) {
			continue;
		}

		players.push({
			playerId: player?.playerId != null ? Number(player.playerId) : null,
			steamId: player?.steamId ?? null,
			race: player?.race != null ? Number(player.race) : null,
			profile: {
				profile_id: profileId,
				alias: player?.alias ?? player?.profile?.alias ?? ''
			}
		});
	}

	return players;
}

function loadPlayerAliasMap(scope, userId) {
	try {
		const snapshotId = scope === 'community' ? 'community' : `user:${userId}`;
		const snapshot = $app.findRecordById('match_filter_snapshots', snapshotId);
		const snapshotPlayers = snapshot.get('players') || [];
		const aliasMap = {};

		for (const player of snapshotPlayers) {
			if (player?.profile_id != null) {
				aliasMap[Number(player.profile_id)] = player.alias ?? '';
			}
		}

		return aliasMap;
	} catch {
		return {};
	}
}

function hasTeamData(players) {
	for (const player of players) {
		if (player.race != null) {
			return true;
		}
	}

	return false;
}

function parseResultField(raw) {
	if (!raw) {
		return null;
	}

	if (typeof raw === 'string' && raw.length > 0) {
		try {
			return JSON.parse(raw);
		} catch {
			return null;
		}
	}

	if (typeof raw === 'object') {
		return raw;
	}

	return null;
}

function summarizePlayersFromResult(result) {
	if (!result || !Array.isArray(result.players)) {
		return [];
	}

	const players = [];

	for (const player of result.players) {
		const profileId = player?.profile_id != null ? Number(player.profile_id) : null;

		if (profileId == null) {
			continue;
		}

		let steamId = player?.steamId ?? null;

		if (!steamId && typeof player?.name === 'string' && player.name.startsWith('/steam/')) {
			steamId = player.name.slice('/steam/'.length);
		}

		players.push({
			playerId: profileId,
			steamId,
			race: player?.race_id != null ? Number(player.race_id) : null,
			profile: {
				profile_id: profileId,
				alias: player?.alias ?? ''
			}
		});
	}

	return players;
}

function summarizePlayersFromCsv(csv, aliasMap) {
	if (typeof csv !== 'string' || csv.length === 0) {
		return [];
	}

	const players = [];

	for (const part of csv.split(',')) {
		if (!part) {
			continue;
		}

		const profileId = Number(part);

		if (Number.isNaN(profileId)) {
			continue;
		}

		players.push({
			playerId: null,
			steamId: null,
			race: null,
			profile: {
				profile_id: profileId,
				alias: aliasMap[profileId] ?? ''
			}
		});
	}

	return players;
}

function loadPlayersByLobbyIds(lobbyIds, aliasMap) {
	if (!lobbyIds || lobbyIds.length === 0) {
		return {};
	}

	const bindings = {};
	const lobbyClauses = [];

	for (let i = 0; i < lobbyIds.length; i++) {
		const key = `lobbyId${i}`;
		bindings[key] = lobbyIds[i];
		lobbyClauses.push(`{:${key}}`);
	}

	const rows = arrayOf(new DynamicModel({ lobby: '', profile_id: 0 }));

	$app
		.db()
		.newQuery(
			`SELECT lobby, profile_id
       FROM lobby_player_index
       WHERE lobby IN (${lobbyClauses.join(', ')})`
		)
		.bind(bindings)
		.all(rows);

	const playersByLobby = {};

	for (const row of rows) {
		if (!playersByLobby[row.lobby]) {
			playersByLobby[row.lobby] = [];
		}

		const profileId = Number(row.profile_id);

		playersByLobby[row.lobby].push({
			playerId: null,
			steamId: null,
			race: null,
			profile: {
				profile_id: profileId,
				alias: aliasMap[profileId] ?? ''
			}
		});
	}

	return playersByLobby;
}

function resolvePlayersForRow(row, aliasMap, playersByLobby) {
	const fromLobbyField = summarizePlayersFromLobbyField(parseLobbyPlayersField(row.lobbyPlayers));

	if (fromLobbyField.length > 0 && hasTeamData(fromLobbyField)) {
		return fromLobbyField;
	}

	const fromResult = summarizePlayersFromResult(parseResultField(row.result));

	if (fromResult.length > 0) {
		return fromResult;
	}

	if (fromLobbyField.length > 0) {
		return fromLobbyField;
	}

	const fromCsv = summarizePlayersFromCsv(row.playerProfileIdsCsv, aliasMap);

	if (fromCsv.length > 0) {
		return fromCsv;
	}

	return playersByLobby[row.id] || [];
}

function countFilteredMatches(hasPlayerFilter, numericPlayerIds, whereClause, bindings) {
	let countSql;

	if (hasPlayerFilter) {
		countSql = `SELECT COUNT(DISTINCT l.id) AS total
       FROM lobby_player_index i
       INNER JOIN lobbies l ON l.id = i.lobby
       WHERE i.profile_id IN (${numericPlayerIds.join(', ')})
         AND ${whereClause}`;
	} else {
		countSql = `SELECT COUNT(*) AS total FROM lobbies l WHERE ${whereClause}`;
	}

	const countRow = new DynamicModel({ total: 0 });
	$app.db().newQuery(countSql).bind(bindings).one(countRow);

	return Number(countRow.total) || 0;
}

module.exports = {
	parseLobbyPlayersField,
	parseResultField,
	summarizePlayersFromLobbyField,
	loadPlayerAliasMap,
	summarizePlayersFromCsv,
	summarizePlayersFromResult,
	loadPlayersByLobbyIds,
	resolvePlayersForRow,
	countFilteredMatches
};
