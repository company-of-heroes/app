/// <reference path="../pb_data/types.d.ts" />

'use strict';

routerAdd('GET', '/api/match-history', (e) => {
	const {
		summarizePlayersFromLobbyField,
		parseLobbyPlayersField,
		loadPlayerAliasMap,
		summarizePlayersFromCsv,
		loadPlayersByLobbyIds,
		resolvePlayersForRow,
		parseResultField,
		countFilteredMatches
	} = require(`${__hooks}/lib/match-history.js`);

	const query = e.request.url.query();

	const scope = query.get('scope') || 'user';

	const userId = query.get('userId') || '';

	const page = Math.max(1, parseInt(query.get('page') || '1', 10) || 1);

	const perPage = Math.min(50, Math.max(1, parseInt(query.get('perPage') || '15', 10) || 15));

	const ranked = query.get('ranked') === 'true';

	const playerIds = (query.get('playerIds') || '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);

	const maps = (query.get('maps') || '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);

	const bindings = {};
	const lobbyFilters = ["l.needsResult = 0", "l.title != 'Skirmish'"];

	if (scope === 'community') {
		lobbyFilters.push("(l.hasReplay = 1 OR (l.replay IS NOT NULL AND l.replay != ''))");
	} else {
		if (!userId) {
			return e.json(400, { message: 'userId required for user scope' });
		}

		bindings.userId = userId;
		lobbyFilters.push('l.user = {:userId}');
	}

	if (ranked) {
		lobbyFilters.push('l.isRanked = 1');
	}

	if (maps.length > 0) {
		const mapClauses = [];

		for (let i = 0; i < maps.length; i++) {
			const key = `map${i}`;
			bindings[key] = maps[i];
			mapClauses.push(`l.map = {:${key}}`);
		}

		lobbyFilters.push(`(${mapClauses.join(' OR ')})`);
	}

	const numericPlayerIds = [];

	for (let i = 0; i < playerIds.length; i++) {
		const profileId = Number(playerIds[i]);

		if (Number.isNaN(profileId)) {
			continue;
		}

		const key = `pid${i}`;
		bindings[key] = profileId;
		numericPlayerIds.push(`{:${key}}`);
	}

	const hasPlayerFilter = numericPlayerIds.length > 0;
	const hasExtraFilters = hasPlayerFilter || maps.length > 0 || ranked;
	const offset = (page - 1) * perPage;

	bindings.limit = perPage;
	bindings.offset = offset;

	const canUseCommunityCountCache = scope === 'community' && !hasExtraFilters;

	try {
		let totalItems = null;

		if (canUseCommunityCountCache) {
			try {
				const snapshot = $app.findRecordById('match_filter_snapshots', 'community');
				const matchCount = snapshot.get('matchCount');

				if (matchCount != null && Number(matchCount) > 0) {
					totalItems = Number(matchCount);
				}
			} catch {
				// snapshot not ready
			}
		}

		const useInlineCount = totalItems === null && !hasExtraFilters;
		const whereClause = lobbyFilters.join(' AND ');

		if (totalItems === null && hasExtraFilters) {
			totalItems = countFilteredMatches(hasPlayerFilter, numericPlayerIds, whereClause, bindings);
		}

		const aliasMap = loadPlayerAliasMap(scope, userId);

		const itemRows = arrayOf(
			new DynamicModel({
				id: '',
				map: '',
				title: '',
				result: '',
				createdAt: '',
				isRanked: false,
				sessionId: 0,
				needsResult: false,
				lobbyPlayers: '',
				playerProfileIdsCsv: '',
				totalCount: 0
			})
		);

		let selectSql;

		if (hasPlayerFilter) {
			selectSql = `SELECT DISTINCT
           l.id,
           l.map,
           l.title,
           COALESCE(l.result, '') AS result,
           l.createdAt,
           l.isRanked,
           l.sessionId,
           l.needsResult,
           COALESCE(l.lobbyPlayers, '[]') AS lobbyPlayers,
           COALESCE(l.playerProfileIdsCsv, '') AS playerProfileIdsCsv${useInlineCount ? ', COUNT(*) OVER() AS totalCount' : ''}
         FROM lobby_player_index i
         INNER JOIN lobbies l ON l.id = i.lobby
         WHERE i.profile_id IN (${numericPlayerIds.join(', ')})
           AND ${whereClause}
         ORDER BY l.createdAt DESC
         LIMIT {:limit} OFFSET {:offset}`;
		} else {
			selectSql = `SELECT
           l.id,
           l.map,
           l.title,
           COALESCE(l.result, '') AS result,
           l.createdAt,
           l.isRanked,
           l.sessionId,
           l.needsResult,
           COALESCE(l.lobbyPlayers, '[]') AS lobbyPlayers,
           COALESCE(l.playerProfileIdsCsv, '') AS playerProfileIdsCsv${useInlineCount ? ', COUNT(*) OVER() AS totalCount' : ''}
         FROM lobbies l
         WHERE ${whereClause}
         ORDER BY l.createdAt DESC
         LIMIT {:limit} OFFSET {:offset}`;
		}

		$app.db().newQuery(selectSql).bind(bindings).all(itemRows);

		const pageRows = itemRows;

		if (useInlineCount) {
			totalItems = pageRows.length > 0 ? Number(pageRows[0].totalCount) || 0 : 0;

			if (canUseCommunityCountCache) {
				try {
					const snapshot = $app.findRecordById('match_filter_snapshots', 'community');
					snapshot.set('matchCount', totalItems);
					$app.save(snapshot);
				} catch {
					// cache write failed
				}
			}
		}

		const unresolvedLobbyIds = [];

		for (const row of pageRows) {
			const fromLobbyField = summarizePlayersFromLobbyField(parseLobbyPlayersField(row.lobbyPlayers));
			const fromCsv = summarizePlayersFromCsv(row.playerProfileIdsCsv, aliasMap);

			if (fromLobbyField.length === 0 && fromCsv.length === 0) {
				unresolvedLobbyIds.push(row.id);
			}
		}

		const playersByLobby = loadPlayersByLobbyIds(unresolvedLobbyIds, aliasMap);
		const items = [];

		for (const row of pageRows) {
			const players = resolvePlayersForRow(row, aliasMap, playersByLobby);
			const result = parseResultField(row.result);

			items.push({
				id: row.id,
				map: row.map,
				title: row.title,
				result,
				createdAt: row.createdAt,
				isRanked: !!row.isRanked,
				sessionId: row.sessionId,
				needsResult: !!row.needsResult,
				players
			});
		}

		return e.json(200, {
			page,
			perPage,
			totalItems,
			totalPages: totalItems > 0 ? Math.ceil(totalItems / perPage) : 0,
			items
		});
	} catch (error) {
		return e.json(400, { message: String(error?.message || error) });
	}
});
