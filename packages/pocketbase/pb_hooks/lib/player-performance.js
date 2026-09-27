'use strict';

const MAP_LIMIT = 8;
const FORM_LIMIT = 10;
const JSON_FALLBACK_CAP = 1500;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_STORE_KEY = 'player_performance_cache_v8';

const AGGREGATE_SHAPE = { dim: '', groupKey: '', wins: 0, losses: 0 };
const RECENT_SHAPE = { id: '', sessionId: 0, outcome: '', raceId: '', matchtypeId: '' };

let indexStatsFields = null;

function emptyPerformance() {
	return {
		matchCount: 0,
		wins: 0,
		losses: 0,
		recentMatches: [],
		byMap: [],
		byFaction: [],
		byMode: []
	};
}

function toNumber(value) {
	if (value === null || value === undefined || value === '') {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function sortByGames(a, b) {
	return b.wins + b.losses - (a.wins + a.losses);
}

function sortByMode(a, b) {
	const aRanked = a.matchtypeId >= 1 && a.matchtypeId <= 4;
	const bRanked = b.matchtypeId >= 1 && b.matchtypeId <= 4;
	if (aRanked !== bRanked) {
		return aRanked ? -1 : 1;
	}
	return a.matchtypeId - b.matchtypeId;
}

function cacheKey(scope, userId, profileId) {
	return scope + ':' + (userId || '') + ':' + String(profileId);
}

function nowMs() {
	return Number(new Date());
}

function getCacheStore() {
	const raw = $app.store().get(CACHE_STORE_KEY);
	if (typeof raw === 'string' && raw) {
		try {
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === 'object') {
				return parsed;
			}
		} catch {
			return {};
		}
	}
	return {};
}

/** Read-only: an expired entry is simply ignored, the next write overwrites it. */
function getCachedPerformance(key) {
	const hit = getCacheStore()[key];
	if (!hit || nowMs() - hit.at > CACHE_TTL_MS) {
		return null;
	}
	return hit.value;
}

function setCachedPerformance(key, value) {
	const store = getCacheStore();
	store[key] = { at: nowMs(), value };
	$app.store().set(CACHE_STORE_KEY, JSON.stringify(store));
}

function invalidateAllPerformanceCache() {
	$app.store().set(CACHE_STORE_KEY, '{}');
}

function invalidatePerformanceCache(userId, profileIds) {
	const store = getCacheStore();
	const keys = Object.keys(store);
	const userPrefix = userId ? 'user:' + userId + ':' : '';
	let changed = false;

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		if (userPrefix && key.indexOf(userPrefix) === 0) {
			delete store[key];
			changed = true;
			continue;
		}
		if (!profileIds) {
			continue;
		}
		for (let j = 0; j < profileIds.length; j++) {
			if (key === 'community::' + String(profileIds[j])) {
				delete store[key];
				changed = true;
			}
		}
	}

	if (changed) {
		$app.store().set(CACHE_STORE_KEY, JSON.stringify(store));
	}
}

/**
 * How much we can get out of `lobby_player_index` alone:
 * `meta` = it also carries the denormalized lobby columns, so no join is needed;
 * `stats` = outcome/race/matchtype only, so `lobbies` still has to be joined;
 * `none`  = fall back to parsing `lobbies.result`.
 *
 * The schema only changes through migrations (which restart the process), so
 * this is memoized per runtime.
 */
function indexCapability() {
	if (indexStatsFields !== null) {
		return indexStatsFields;
	}

	try {
		const fields = $app.findCollectionByNameOrId('lobby_player_index').fields;
		if (fields.getByName('session_id')) {
			indexStatsFields = 'meta';
		} else if (fields.getByName('steam_id')) {
			indexStatsFields = 'stats';
		} else {
			indexStatsFields = 'none';
		}
	} catch {
		indexStatsFields = 'none';
	}

	return indexStatsFields;
}

function queryAll(sql, bindings, shape) {
	const rows = arrayOf(new DynamicModel(shape));
	$app.db().newQuery(sql).bind(bindings).all(rows);
	return rows;
}

function loadSteamIds(userId) {
	if (!userId) {
		return [];
	}

	try {
		return require(`${__hooks}/lib/match-history.js`).loadUserSteamIds(userId);
	} catch {
		return [];
	}
}

/** Inlines steam ids as bind params so SQLite can use the steam_id indexes. */
function steamIdClause(steamIds, bindings) {
	const placeholders = [];

	for (let i = 0; i < steamIds.length; i++) {
		const key = 'sid' + String(i);
		bindings[key] = steamIds[i];
		placeholders.push('{:' + key + '}');
	}

	return `i.steam_id IN (${placeholders.join(', ')})`;
}

/** Filters against the denormalized columns only, so `lobbies` stays untouched. */
function metaFilters(scope, steamIds, bindings) {
	const { notHiddenSessionClause, notHiddenTitleBySessionClause } =
		require(`${__hooks}/lib/hidden-matches.js`);
	const filters = [
		'i.counts = 1',
		'i.session_id > 0',
		'i.outcome IN (0, 1)',
		notHiddenSessionClause('i.session_id'),
		notHiddenTitleBySessionClause('i.session_id')
	];

	if (scope === 'community') {
		filters.push('i.profile_id = {:profileId}');
		return filters;
	}

	filters.push(userIndexIdentity(steamIds, bindings));

	return filters;
}

function profileBelongsToSteamIds(profileId, steamIds) {
	const id = Number(profileId);
	if (!Number.isInteger(id) || id <= 0 || !steamIds || steamIds.length === 0) {
		return false;
	}

	try {
		const record = require(`${__hooks}/lib/player-ratings.js`).findByProfileId(id);
		if (!record) {
			return false;
		}

		const steamId = String(record.get('steamId') || '');
		return steamIds.indexOf(steamId) !== -1;
	} catch {
		return false;
	}
}

function userIndexIdentity(steamIds, bindings) {
	const parts = [];
	if (steamIds.length > 0) {
		parts.push(steamIdClause(steamIds, bindings));
	}

	const profileId = Number(bindings.profileId);
	const allowProfile =
		Number.isInteger(profileId) &&
		profileId > 0 &&
		(steamIds.length === 0 || profileBelongsToSteamIds(profileId, steamIds));
	if (allowProfile) {
		parts.push('i.profile_id = {:profileId}');
	}

	if (parts.length === 0) {
		return '1 = 0';
	}

	return `(${parts.join(' OR ')})`;
}

function joinFilters(scope, steamIds, bindings) {
	const { notHiddenSessionClause, notHiddenTitleClause, lobbyDescriptionSql } =
		require(`${__hooks}/lib/hidden-matches.js`);
	const filters = [
		'l.needsResult = 0',
		"l.title != 'Skirmish'",
		'l.sessionId > 0',
		'i.outcome IN (0, 1)',
		notHiddenSessionClause('l.sessionId'),
		notHiddenTitleClause(lobbyDescriptionSql('l'))
	];

	if (scope === 'community') {
		filters.push('i.profile_id = {:profileId}');
		return filters;
	}

	filters.push(userIndexIdentity(steamIds, bindings));

	return filters;
}

/** One row per session, deduped for users with several linked steam accounts. */
function metaMatchesSql(scope, steamIds, bindings) {
	return `SELECT
			 i.map AS map,
			 i.outcome AS outcome,
			 i.race_id AS raceId,
			 i.matchtype_id AS matchtypeId,
			 ROW_NUMBER() OVER (PARTITION BY i.session_id ORDER BY i.id) AS rn
		 FROM lobby_player_index i
		 WHERE ${metaFilters(scope, steamIds, bindings).join(' AND ')}`;
}

function joinMatchesSql(scope, steamIds, bindings) {
	return `SELECT
			 l.map AS map,
			 i.outcome AS outcome,
			 i.race_id AS raceId,
			 i.matchtype_id AS matchtypeId,
			 ROW_NUMBER() OVER (PARTITION BY l.sessionId ORDER BY i.id) AS rn
		 FROM lobbies l
		 INNER JOIN lobby_player_index i ON i.lobby = l.id
		 WHERE ${joinFilters(scope, steamIds, bindings).join(' AND ')}`;
}

function jsonMatchesSql(scope, profileId, bindings, steamIds) {
	const { notHiddenSessionClause, notHiddenTitleClause, lobbyDescriptionSql } =
		require(`${__hooks}/lib/hidden-matches.js`);
	const { userPlayedLobbyClause } = require(`${__hooks}/lib/match-history.js`);
	const lobbyFilters = [
		'l.needsResult = 0',
		"l.title != 'Skirmish'",
		'l.sessionId > 0',
		notHiddenSessionClause('l.sessionId'),
		notHiddenTitleClause(lobbyDescriptionSql('l'))
	];
	const playerClauses = [];

	if (scope === 'community') {
		bindings.csvNeedle = `%,${profileId},%`;
		lobbyFilters.push('l.playerProfileIdsCsv LIKE {:csvNeedle}');
		playerClauses.push("CAST(json_extract(p.value, '$.profile_id') AS INTEGER) = {:profileId}");
	} else {
		const allowProfile =
			profileId &&
			((steamIds || []).length === 0 || profileBelongsToSteamIds(profileId, steamIds || []));
		lobbyFilters.push(
			userPlayedLobbyClause(
				'l',
				{
					steamIds: steamIds || [],
					profileIds: allowProfile ? [profileId] : []
				},
				bindings
			)
		);
		if (allowProfile) {
			playerClauses.push("CAST(json_extract(p.value, '$.profile_id') AS INTEGER) = {:profileId}");
		}
		playerClauses.push(`json_extract(p.value, '$.steamId') IN (
			SELECT json_each.value
			FROM json_each((SELECT steamIds FROM users WHERE id = {:userId}))
		)`);
		playerClauses.push(`json_extract(p.value, '$.name') IN (
			SELECT '/steam/' || json_each.value
			FROM json_each((SELECT steamIds FROM users WHERE id = {:userId}))
		)`);
	}

	bindings.cap = JSON_FALLBACK_CAP;

	return `SELECT
			 s.map AS map,
			 CAST(json_extract(p.value, '$.outcome') AS INTEGER) AS outcome,
			 CAST(json_extract(p.value, '$.race_id') AS INTEGER) AS raceId,
			 CAST(json_extract(s.result, '$.matchtype_id') AS INTEGER) AS matchtypeId,
			 ROW_NUMBER() OVER (
				 PARTITION BY s.sessionId
				 ORDER BY json_extract(p.value, '$.outcome')
			 ) AS rn
		 FROM (
			 SELECT l.sessionId, l.map, l.result
			 FROM lobbies l
			 WHERE ${lobbyFilters.join(' AND ')}
			 ORDER BY l.sessionId DESC
			 LIMIT {:cap}
		 ) AS s,
		 json_each(
			 CASE
				 WHEN s.result IS NOT NULL AND s.result != ''
							AND json_valid(s.result)
							AND json_type(json_extract(s.result, '$.players')) = 'array'
				 THEN json_extract(s.result, '$.players')
				 ELSE '[]'
			 END
		 ) AS p
		 WHERE (${playerClauses.join(' OR ')})
			 AND CAST(json_extract(p.value, '$.outcome') AS INTEGER) IN (0, 1)`;
}

/**
 * Aggregates in SQLite instead of JS: returns ~30-50 grouped rows rather than
 * one row per match, which is what made this endpoint slow (goja marshalling).
 */
function aggregateSql(matchesSql) {
	const wins = 'SUM(CASE WHEN outcome = 1 THEN 1 ELSE 0 END)';
	const losses = 'SUM(CASE WHEN outcome = 0 THEN 1 ELSE 0 END)';
	const mapKey = "COALESCE(NULLIF(map, ''), 'Unknown')";

	return `WITH
		 raw AS (${matchesSql}),
		 d AS (SELECT * FROM raw WHERE rn = 1)
	 SELECT 'total' AS dim, '' AS groupKey,
			COALESCE(${wins}, 0) AS wins,
			COALESCE(${losses}, 0) AS losses
		 FROM d
	 UNION ALL
	 SELECT 'map', ${mapKey}, ${wins}, ${losses}
		 FROM d
		 GROUP BY ${mapKey}
	 UNION ALL
	 SELECT 'race', CAST(raceId AS TEXT), ${wins}, ${losses}
		 FROM d
		 WHERE raceId IS NOT NULL AND raceId BETWEEN 0 AND 3
		 GROUP BY raceId
	 UNION ALL
	 SELECT 'mode', CAST(matchtypeId AS TEXT), ${wins}, ${losses}
		 FROM d
		 WHERE matchtypeId IS NOT NULL
		 GROUP BY matchtypeId`;
}

function mapAggregateRows(rows) {
	const byMap = [];
	const byFaction = [];
	const byMode = [];
	let wins = 0;
	let losses = 0;

	for (const row of rows) {
		const rowWins = toNumber(row.wins) || 0;
		const rowLosses = toNumber(row.losses) || 0;

		if (row.dim === 'total') {
			wins = rowWins;
			losses = rowLosses;
			continue;
		}

		if (row.dim === 'map') {
			byMap.push({ map: row.groupKey || 'Unknown', wins: rowWins, losses: rowLosses });
			continue;
		}

		if (row.dim === 'race') {
			const raceId = toNumber(row.groupKey);
			if (raceId != null) {
				byFaction.push({ raceId, wins: rowWins, losses: rowLosses });
			}
			continue;
		}

		if (row.dim === 'mode') {
			const matchtypeId = toNumber(row.groupKey);
			if (matchtypeId != null) {
				byMode.push({ matchtypeId, wins: rowWins, losses: rowLosses });
			}
		}
	}

	return {
		matchCount: wins + losses,
		wins,
		losses,
		recentMatches: [],
		byMap: byMap.sort(sortByGames).slice(0, MAP_LIMIT),
		byFaction: byFaction.sort(sortByGames),
		byMode: byMode.sort(sortByMode)
	};
}

function loadAggregates(profileId, scope, userId, steamIds) {
	const bindings = { profileId, userId };
	const capability = indexCapability();
	let matchesSql;

	if (capability === 'meta') {
		matchesSql = metaMatchesSql(scope, steamIds, bindings);
	} else if (capability === 'stats') {
		matchesSql = joinMatchesSql(scope, steamIds, bindings);
	} else {
		matchesSql = jsonMatchesSql(scope, profileId, bindings, steamIds);
	}

	return mapAggregateRows(queryAll(aggregateSql(matchesSql), bindings, AGGREGATE_SHAPE));
}

function rowsToRecentMatches(rows) {
	const seen = new Set();
	const recent = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const sessionId = toNumber(row.sessionId);
		const outcome = toNumber(row.outcome);

		if (sessionId == null || sessionId <= 0 || seen.has(sessionId)) {
			continue;
		}
		if (outcome !== 0 && outcome !== 1) {
			continue;
		}

		seen.add(sessionId);
		recent.push({
			id: String(row.id || ''),
			sessionId,
			outcome,
			raceId: toNumber(row.raceId),
			matchtypeId: toNumber(row.matchtypeId)
		});

		if (recent.length >= FORM_LIMIT) {
			break;
		}
	}

	return recent;
}

function loadRecentMatches(profileId, scope, userId, steamIds) {
	const capability = indexCapability();

	if (capability === 'meta') {
		const bindings = { profileId, userId, formLimit: FORM_LIMIT * 4 };

		return rowsToRecentMatches(
			queryAll(
				`SELECT
					 i.lobby AS id,
					 i.session_id AS sessionId,
					 i.outcome AS outcome,
					 i.race_id AS raceId,
					 i.matchtype_id AS matchtypeId
				 FROM lobby_player_index i
				 WHERE ${metaFilters(scope, steamIds, bindings).join(' AND ')}
				 ORDER BY i.session_id DESC
				 LIMIT {:formLimit}`,
				bindings,
				RECENT_SHAPE
			)
		);
	}

	if (capability === 'stats') {
		const bindings = { profileId, userId, formLimit: FORM_LIMIT * 4 };

		return rowsToRecentMatches(
			queryAll(
				`SELECT
					 l.id AS id,
					 l.sessionId AS sessionId,
					 i.outcome AS outcome,
					 i.race_id AS raceId,
					 i.matchtype_id AS matchtypeId
				 FROM lobbies l
				 INNER JOIN lobby_player_index i ON i.lobby = l.id
				 WHERE ${joinFilters(scope, steamIds, bindings).join(' AND ')}
				 ORDER BY l.sessionId DESC
				 LIMIT {:formLimit}`,
				bindings,
				RECENT_SHAPE
			)
		);
	}

	const { userPlayedLobbyClause } = require(`${__hooks}/lib/match-history.js`);
	const bindings = { profileId, userId, lobbyLimit: 50, formLimit: FORM_LIMIT * 4 };
	const allowProfile =
		profileId &&
		((steamIds || []).length === 0 || profileBelongsToSteamIds(profileId, steamIds || []));
	const playerClauses = [];
	if (allowProfile) {
		playerClauses.push("CAST(json_extract(p.value, '$.profile_id') AS INTEGER) = {:profileId}");
	}
	playerClauses.push(
		`json_extract(p.value, '$.steamId') IN (
			SELECT json_each.value
			FROM json_each((SELECT steamIds FROM users WHERE id = {:userId}))
		)`,
		`json_extract(p.value, '$.name') IN (
			SELECT '/steam/' || json_each.value
			FROM json_each((SELECT steamIds FROM users WHERE id = {:userId}))
		)`
	);
	const hidden = require(`${__hooks}/lib/hidden-matches.js`);
	const played = userPlayedLobbyClause(
		's',
		{ steamIds, profileIds: allowProfile ? [profileId] : [] },
		bindings
	);

	return rowsToRecentMatches(
		queryAll(
			`SELECT
				 l.id AS id,
				 l.sessionId AS sessionId,
				 json_extract(p.value, '$.outcome') AS outcome,
				 json_extract(p.value, '$.race_id') AS raceId,
				 json_extract(l.result, '$.matchtype_id') AS matchtypeId
			 FROM (
				 SELECT s.id, s.sessionId, s.result
				 FROM lobbies s
				 WHERE s.needsResult = 0 AND s.title != 'Skirmish'
				   AND ${played}
				   AND ${hidden.notHiddenSessionClause('s.sessionId')}
				   AND ${hidden.notHiddenTitleClause(hidden.lobbyDescriptionSql('s'))}
				 ORDER BY s.sessionId DESC
				 LIMIT {:lobbyLimit}
			 ) AS l,
			 json_each(
				 CASE
					 WHEN l.result IS NOT NULL AND l.result != ''
								AND json_valid(l.result)
								AND json_type(json_extract(l.result, '$.players')) = 'array'
					 THEN json_extract(l.result, '$.players')
					 ELSE '[]'
				 END
			 ) AS p
			 WHERE (${playerClauses.join(' OR ')})
				 AND CAST(json_extract(p.value, '$.outcome') AS INTEGER) IN (0, 1)
			 ORDER BY l.sessionId DESC
			 LIMIT {:formLimit}`,
			bindings,
			RECENT_SHAPE
		)
	);
}

function loadPlayerPerformance(profileId, scope, userId, timings, skipCache) {
	const key = cacheKey(scope, userId, profileId);
	if (!skipCache) {
		const cached = getCachedPerformance(key);

		if (cached) {
			if (timings) {
				timings.cache = 'hit';
			}
			return cached;
		}
	}

	if (timings) {
		timings.cache = skipCache ? 'skip' : 'miss';
	}

	const steamIds = scope === 'user' ? loadSteamIds(userId) : [];
	let startedAt = nowMs();
	let data;

	try {
		data = loadAggregates(profileId, scope, userId, steamIds);
	} catch (error) {
		console.warn(
			'[player_performance] aggregate query failed, using result json:',
			String(error?.message || error)
		);
		const bindings = { profileId, userId };
		data = mapAggregateRows(
			queryAll(
				aggregateSql(jsonMatchesSql(scope, profileId, bindings, steamIds)),
				bindings,
				AGGREGATE_SHAPE
			)
		);
	}

	if (timings) {
		timings.aggregateMs = nowMs() - startedAt;
	}

	startedAt = nowMs();

	try {
		data.recentMatches = loadRecentMatches(profileId, scope, userId, steamIds);
	} catch (error) {
		console.warn(
			'[player_performance] recent matches failed:',
			String(error?.message || error)
		);
	}

	if (timings) {
		timings.recentMs = nowMs() - startedAt;
	}

	setCachedPerformance(key, data);
	return data;
}

module.exports = {
	emptyPerformance,
	loadPlayerPerformance,
	invalidatePerformanceCache,
	invalidateAllPerformanceCache
};
