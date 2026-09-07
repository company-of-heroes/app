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
		countFilteredMatches,
		readCommunityMatchCount,
		saveCommunityMatchCount,
		buildIndexPlayerConditions,
		buildProFilterClause,
		buildSortClause,
		parseCompareOp,
		parseOptionalNumber,
		compareClause,
		loadUserSteamIds,
		userPlayedLobbyClause
	} = require(`${__hooks}/lib/match-history.js`);

	const query = e.request.url.query();

	const scope = query.get('scope') || 'user';

	const userId = query.get('userId') || '';

	const page = Math.max(1, parseInt(query.get('page') || '1', 10) || 1);

	const perPage = Math.min(50, Math.max(1, parseInt(query.get('perPage') || '15', 10) || 15));

	const ranked = query.get('ranked') === 'true';
	const pro = query.get('pro') === 'true';

	const playerIds = (query.get('playerIds') || '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);

	const maps = (query.get('maps') || '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);

	const races = (query.get('races') || '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean)
		.map((value) => Number(value))
		.filter((value) => !Number.isNaN(value) && value >= 0 && value <= 3);

	const slots = (query.get('slots') || '')
		.split(',')
		.map((value) => Number(value.trim()))
		.filter((value) => Number.isInteger(value) && value >= 1 && value <= 8);

	const matchtypes = (query.get('matchtypes') || '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean)
		.map((value) => Number(value))
		.filter((value) => Number.isFinite(value));

	const exactMatchtypes = query.get('exactMatchtypes') === 'true';
	const includeSkirmish = query.get('includeSkirmish') === 'true';

	let eloOp = parseCompareOp(query.get('eloOp') || '');
	let eloValue = parseOptionalNumber(query.get('elo'));
	if (!eloOp) {
		const minElo = parseOptionalNumber(query.get('minElo'));
		const maxElo = parseOptionalNumber(query.get('maxElo'));
		if (Number.isFinite(minElo)) {
			eloOp = 'gte';
			eloValue = minElo;
		} else if (Number.isFinite(maxElo)) {
			eloOp = 'lte';
			eloValue = maxElo;
		}
	}
	if (!Number.isFinite(eloValue)) {
		eloOp = '';
		eloValue = NaN;
	}

	let durationOp = parseCompareOp(query.get('durationOp') || '');
	let durationSeconds = parseOptionalNumber(query.get('duration') || query.get('minDuration'));
	if (!durationOp) {
		const minDuration = parseOptionalNumber(query.get('minDuration'));
		const maxDuration = parseOptionalNumber(query.get('maxDuration'));
		if (Number.isFinite(minDuration)) {
			durationOp = 'gte';
			durationSeconds = minDuration;
		} else if (Number.isFinite(maxDuration)) {
			durationOp = 'lte';
			durationSeconds = maxDuration;
		}
	}
	if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
		durationOp = '';
		durationSeconds = NaN;
	}

	const sort = query.get('sort') || 'createdAt';
	const sortDir = query.get('sortDir') || 'desc';
	const orderBy = buildSortClause(sort, sortDir);

	const bindings = {};
	const { notHiddenSessionClause, notHiddenTitleClause, lobbyDescriptionSql, isStaffAuth } =
		require(`${__hooks}/lib/hidden-matches.js`);
	const includeHidden = isStaffAuth(e.auth);

	const lobbyFilters = includeSkirmish
		? ["(l.needsResult = 0 OR l.title = 'Skirmish')"]
		: ["l.needsResult = 0", "l.title != 'Skirmish'"];

	if (!includeHidden) {
		lobbyFilters.push(notHiddenSessionClause('l.sessionId'));
	}

	if (scope === 'community') {
		lobbyFilters.push('l.hasReplay = 1');
		lobbyFilters.push("(l.memberReplay = '' OR l.memberReplay IS NULL)");
	} else {
		if (!userId) {
			return e.json(400, { message: 'userId required for user scope' });
		}

		bindings.userId = userId;
	}

	if (ranked) {
		lobbyFilters.push('l.isRanked = 1');
	}

	if (pro) {
		lobbyFilters.push(buildProFilterClause());
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

	if (matchtypes.length > 0) {
		const matchtypeClauses = [];
		const playerCountKeys = [];
		const playerCountByType = {
			1: 2,
			2: 4,
			3: 6,
			4: 8,
			5: 4,
			6: 6,
			7: 8
		};
		const playerCounts = {};

		for (let i = 0; i < matchtypes.length; i++) {
			const key = `matchtype${i}`;
			bindings[key] = matchtypes[i];
			matchtypeClauses.push(`{:${key}}`);
			// History 4v4 also includes 8-player basic matches; performance rows are exact ids.
			if (exactMatchtypes) {
				continue;
			}
			const count = playerCountByType[matchtypes[i]];
			if (count && !playerCounts[count]) {
				playerCounts[count] = true;
				const countKey = `matchPlayers${i}`;
				bindings[countKey] = count;
				playerCountKeys.push(`{:${countKey}}`);
			}
		}

		const typeClause = `CAST(json_extract(l.result, '$.matchtype_id') AS INTEGER) IN (${matchtypeClauses.join(', ')})`;
		if (playerCountKeys.length > 0) {
			lobbyFilters.push(
				`(${typeClause}
          OR (
            (json_extract(l.result, '$.matchtype_id') IS NULL
              OR CAST(json_extract(l.result, '$.matchtype_id') AS INTEGER) = 0)
            AND json_array_length(json_extract(l.result, '$.players')) IN (${playerCountKeys.join(', ')})
          ))`
			);
		} else {
			lobbyFilters.push(typeClause);
		}
	}

	if (durationOp && Number.isFinite(durationSeconds)) {
		lobbyFilters.push(compareClause('l.durationSeconds', durationOp, 'durationSeconds', durationSeconds, bindings));
	}

	const numericPlayerIds = [];
	const numericPlayerIdValues = [];

	for (let i = 0; i < playerIds.length; i++) {
		const profileId = Number(playerIds[i]);

		if (Number.isNaN(profileId)) {
			continue;
		}

		const key = `pid${i}`;
		bindings[key] = profileId;
		numericPlayerIds.push(`{:${key}}`);
		numericPlayerIdValues.push(profileId);
	}

	const subjectProfileId = Number(query.get('profileId') || '');
	const userProfileIds =
		Number.isFinite(subjectProfileId) && subjectProfileId > 0 ? [subjectProfileId] : [];

	const hasPlayerFilter = numericPlayerIds.length > 0;
	const userSteamIds = scope === 'user' ? loadUserSteamIds(userId) : [];
	if (scope === 'user') {
		lobbyFilters.push(
			userPlayedLobbyClause('l', { steamIds: userSteamIds, profileIds: userProfileIds }, bindings)
		);
	}
	const indexSubjects =
		hasPlayerFilter
			? { steamIds: [], profileIds: [] }
			: scope === 'user'
				? { steamIds: userSteamIds, profileIds: userProfileIds }
				: { steamIds: [], profileIds: [] };

	const indexConditions = buildIndexPlayerConditions(
		{
			races,
			slots,
			eloOp,
			eloValue,
			steamIds: indexSubjects.steamIds,
			profileIds: indexSubjects.profileIds
		},
		bindings,
		{
			allowAnyPlayer: hasPlayerFilter || scope === 'community'
		}
	);

	let joinExtra = '';
	if (indexConditions) {
		if (hasPlayerFilter) {
			joinExtra = `AND ${indexConditions}`;
		} else {
			lobbyFilters.push(
				`EXISTS (SELECT 1 FROM lobby_player_index i WHERE i.lobby = l.id AND ${indexConditions})`
			);
		}
	}

	const hasRaceOrEloFilter = !!indexConditions;
	const hasMatchtypeFilter = matchtypes.length > 0;
	const hasDurationFilter = !!(durationOp && Number.isFinite(durationSeconds));
	const hasExtraFilters =
		hasPlayerFilter ||
		maps.length > 0 ||
		ranked ||
		pro ||
		hasRaceOrEloFilter ||
		hasMatchtypeFilter ||
		hasDurationFilter;
	const offset = (page - 1) * perPage;

	const canUseCommunityCountCache = scope === 'community' && !hasExtraFilters && !includeHidden;

	const selectColumns = `l.id,
           l.map,
           l.title,
           COALESCE(l.result, '') AS result,
           l.createdAt,
           l.isRanked,
           l.sessionId,
           l.needsResult,
           COALESCE(l.hasReplay, 0) AS hasReplay,
           COALESCE(l.likeCount, 0) AS likeCount,
           COALESCE(l.downloadCount, 0) AS downloadCount,
           COALESCE(l.commentCount, 0) AS commentCount,
           COALESCE(l.durationSeconds, 0) AS durationSeconds,
           COALESCE(l.lobbyPlayers, '[]') AS lobbyPlayers,
           COALESCE(l.playerProfileIdsCsv, '') AS playerProfileIdsCsv`;

	try {
		let totalItems = null;

		if (canUseCommunityCountCache) {
			totalItems = readCommunityMatchCount();
		}

		const whereClause = lobbyFilters.join(' AND ');
		// Skip the correlated preferred-lobby subquery: it made LIMIT ignore
		// createdAt and drop newest community rows. Duplicates are blocked on create.
		// Hidden-title LIKE on json_extract(result) is applied only to the page rows —
		// putting it in COUNT scanned every result blob (~13s on the local DB).
		const selectWhere = includeHidden
			? whereClause
			: `${whereClause} AND ${notHiddenTitleClause(lobbyDescriptionSql('l'))}`;

		if (totalItems === null) {
			totalItems = countFilteredMatches(
				hasPlayerFilter,
				numericPlayerIds,
				whereClause,
				bindings,
				joinExtra
			);
			if (canUseCommunityCountCache) {
				saveCommunityMatchCount(totalItems);
			}
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
				hasReplay: false,
				likeCount: 0,
				downloadCount: 0,
				commentCount: 0,
				durationSeconds: 0,
				lobbyPlayers: '',
				playerProfileIdsCsv: ''
			})
		);

		let selectSql;

		if (hasPlayerFilter) {
			selectSql = `SELECT DISTINCT
           ${selectColumns}
         FROM lobby_player_index i
         INNER JOIN lobbies l ON l.id = i.lobby
         WHERE i.profile_id IN (${numericPlayerIds.join(', ')})
           ${joinExtra}
           AND ${selectWhere}
         ORDER BY ${orderBy}
         LIMIT ${perPage} OFFSET ${offset}`;
		} else {
			selectSql = `SELECT
           ${selectColumns}
         FROM lobbies l
         WHERE ${selectWhere}
         ORDER BY ${orderBy}
         LIMIT ${perPage} OFFSET ${offset}`;
		}

		$app.db().newQuery(selectSql).bind(bindings).all(itemRows);

		const pageRows = itemRows;

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
			// List UI only needs outcomes for team win/loss tint — drop the fat result blob.
			const slimResult =
				result && Array.isArray(result.players)
					? {
							players: result.players.map((player) => ({
								profile_id: player.profile_id,
								outcome: player.outcome
							}))
						}
					: null;
			const storedDuration = Number(row.durationSeconds);
			const durationSeconds =
				Number.isFinite(storedDuration) && storedDuration > 0
					? storedDuration
					: (() => {
							const start = Number(result?.startgametime);
							const end = Number(result?.completiontime);
							if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
								return end - start;
							}
							return null;
						})();

			items.push({
				id: row.id,
				map: row.map,
				title: row.title,
				result: slimResult,
				createdAt: row.createdAt,
				isRanked: !!row.isRanked,
				sessionId: row.sessionId,
				needsResult: !!row.needsResult,
				hasReplay: !!row.hasReplay,
				likeCount: Number(row.likeCount) || 0,
				downloadCount: Number(row.downloadCount) || 0,
				commentCount: Number(row.commentCount) || 0,
				durationSeconds,
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

$app.onServe().bindFunc((e) => {
	e.next();
	// Defer index ensure — CREATE INDEX on lobbies must not block listen.
	cronAdd('community_replay_index_ensure', '9 * * * *', () => {
		require(`${__hooks}/lib/match-history.js`).ensureCommunityReplayIndex();
	});
});
