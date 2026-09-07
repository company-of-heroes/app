// Public player compare + head-to-head from lobby_player_index.
'use strict';

const { emptyPerformance, loadPlayerPerformance } = require(`${__hooks}/lib/player-performance.js`);
const ratings = require(`${__hooks}/lib/player-ratings.js`);
const player = require(`${__hooks}/lib/player.js`);

const RECENT_LIMIT = 10;
const MAX_BATCH_VS = 16;

const ALLOWED_ORIGINS = [
	'https://coh1stats.com',
	'https://www.coh1stats.com',
	'http://localhost:5174',
	'http://127.0.0.1:5174'
];

const CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

function applyCors(e) {
	const origin = e.request.header.get('Origin');
	if (origin && ALLOWED_ORIGINS.includes(origin)) {
		e.response.header().set('Access-Control-Allow-Origin', origin);
		e.response.header().set('Vary', 'Origin');
	}
	e.response.header().set('Access-Control-Allow-Methods', 'GET, OPTIONS');
	e.response.header().set('Access-Control-Allow-Headers', 'Content-Type');
}

function jsonWithCors(e, status, body) {
	applyCors(e);
	e.response.header().set('Cache-Control', CACHE_CONTROL);
	return e.json(status, body);
}

function handleOptions(e) {
	applyCors(e);
	return e.noContent(204);
}

function parseProfileId(value) {
	const id = Number(value);
	if (!Number.isInteger(id) || id <= 0) {
		return null;
	}
	return id;
}

function parseVsIds(raw) {
	if (!raw || typeof raw !== 'string') {
		return [];
	}

	const seen = {};
	const ids = [];
	const parts = raw.split(',');

	for (let i = 0; i < parts.length; i++) {
		const id = parseProfileId(parts[i].trim());
		if (id == null || seen[id]) {
			continue;
		}
		seen[id] = true;
		ids.push(id);
		if (ids.length >= MAX_BATCH_VS) {
			break;
		}
	}

	return ids;
}

function queryAll(sql, bindings, shape) {
	const rows = arrayOf(new DynamicModel(shape));
	$app.db().newQuery(sql).bind(bindings).all(rows);
	return rows;
}

function indexHasMeta() {
	try {
		return Boolean($app.findCollectionByNameOrId('lobby_player_index').fields.getByName('session_id'));
	} catch {
		return false;
	}
}

function indexHasCounts() {
	try {
		return Boolean($app.findCollectionByNameOrId('lobby_player_index').fields.getByName('counts'));
	} catch {
		return false;
	}
}

function opponentBaseFilters() {
	const { notHiddenSessionClause, notHiddenTitleBySessionClause } =
		require(`${__hooks}/lib/hidden-matches.js`);
	const filters = [
		'a.outcome IN (0, 1)',
		'b.outcome IN (0, 1)',
		'a.outcome != b.outcome'
	];

	if (indexHasCounts()) {
		filters.push('a.counts = 1');
	}

	if (indexHasMeta()) {
		filters.push('a.session_id > 0');
		filters.push(notHiddenSessionClause('a.session_id'));
		filters.push(notHiddenTitleBySessionClause('a.session_id'));
	}

	return filters;
}

function emptyH2h() {
	return {
		played: 0,
		winsLeft: 0,
		winsRight: 0,
		together: 0,
		byMode: [],
		byMap: [],
		recent: []
	};
}

function loadElo(profileId) {
	try {
		const record = ratings.findByProfileId(profileId);
		if (!record) {
			return {};
		}
		return ratings.serializeRecord(record)?.elo ?? {};
	} catch {
		return {};
	}
}

function loadComparePlayer(profileId) {
	const page = player.loadPlayerPage(String(profileId), { extras: false });
	let performance = emptyPerformance();
	try {
		performance = loadPlayerPerformance(page.profileId, 'community', '', null, false);
	} catch {
		performance = emptyPerformance();
	}

	return {
		steamId: page.steamId,
		profileId: page.profileId,
		alias: page.alias,
		country: page.country,
		level: page.level,
		avatarUrl: page.avatarUrl,
		leaderboardStats: page.leaderboardStats ?? [],
		elo: loadElo(page.profileId),
		performance
	};
}

function loadH2hPair(leftId, rightId) {
	if (!indexHasMeta() && !indexHasCounts()) {
		return emptyH2h();
	}

	const filters = opponentBaseFilters();
	const where = filters.join(' AND ');
	const bindings = { leftId, rightId };

	const summaryRows = queryAll(
		`SELECT
       COUNT(*) AS played,
       SUM(CASE WHEN a.outcome = 1 AND b.outcome = 0 THEN 1 ELSE 0 END) AS wins_left,
       SUM(CASE WHEN a.outcome = 0 AND b.outcome = 1 THEN 1 ELSE 0 END) AS wins_right
     FROM lobby_player_index a
     JOIN lobby_player_index b ON a.lobby = b.lobby
     WHERE a.profile_id = {:leftId} AND b.profile_id = {:rightId}
       AND ${where}`,
		bindings,
		{ played: 0, wins_left: 0, wins_right: 0 }
	);

	const summary = summaryRows[0] || { played: 0, wins_left: 0, wins_right: 0 };

	const togetherFilters = [
		'a.outcome IN (0, 1)',
		'b.outcome IN (0, 1)',
		'a.outcome = b.outcome'
	];
	if (indexHasCounts()) {
		togetherFilters.push('a.counts = 1');
	}
	if (indexHasMeta()) {
		const { notHiddenSessionClause, notHiddenTitleBySessionClause } =
			require(`${__hooks}/lib/hidden-matches.js`);
		togetherFilters.push('a.session_id > 0');
		togetherFilters.push(notHiddenSessionClause('a.session_id'));
		togetherFilters.push(notHiddenTitleBySessionClause('a.session_id'));
	}

	const togetherRows = queryAll(
		`SELECT COUNT(*) AS together
     FROM lobby_player_index a
     JOIN lobby_player_index b ON a.lobby = b.lobby
     WHERE a.profile_id = {:leftId} AND b.profile_id = {:rightId}
       AND ${togetherFilters.join(' AND ')}`,
		bindings,
		{ together: 0 }
	);

	let byMode = [];
	let byMap = [];
	let recent = [];

	if (indexHasMeta()) {
		const byModeRows = queryAll(
			`SELECT a.matchtype_id AS matchtype_id,
         COUNT(*) AS played,
         SUM(CASE WHEN a.outcome = 1 AND b.outcome = 0 THEN 1 ELSE 0 END) AS wins_left,
         SUM(CASE WHEN a.outcome = 0 AND b.outcome = 1 THEN 1 ELSE 0 END) AS wins_right
       FROM lobby_player_index a
       JOIN lobby_player_index b ON a.lobby = b.lobby
       WHERE a.profile_id = {:leftId} AND b.profile_id = {:rightId}
         AND ${where}
       GROUP BY a.matchtype_id
       ORDER BY played DESC`,
			bindings,
			{ matchtype_id: 0, played: 0, wins_left: 0, wins_right: 0 }
		);

		const byMapRows = queryAll(
			`SELECT a.map AS map,
         COUNT(*) AS played,
         SUM(CASE WHEN a.outcome = 1 AND b.outcome = 0 THEN 1 ELSE 0 END) AS wins_left,
         SUM(CASE WHEN a.outcome = 0 AND b.outcome = 1 THEN 1 ELSE 0 END) AS wins_right
       FROM lobby_player_index a
       JOIN lobby_player_index b ON a.lobby = b.lobby
       WHERE a.profile_id = {:leftId} AND b.profile_id = {:rightId}
         AND ${where}
         AND a.map IS NOT NULL AND a.map != ''
       GROUP BY a.map
       ORDER BY played DESC
       LIMIT 12`,
			bindings,
			{ map: '', played: 0, wins_left: 0, wins_right: 0 }
		);

		const recentRows = queryAll(
			`SELECT a.lobby AS lobby,
         a.session_id AS session_id,
         a.map AS map,
         a.matchtype_id AS matchtype_id,
         a.outcome AS left_outcome,
         b.outcome AS right_outcome
       FROM lobby_player_index a
       JOIN lobby_player_index b ON a.lobby = b.lobby
       WHERE a.profile_id = {:leftId} AND b.profile_id = {:rightId}
         AND ${where}
       ORDER BY a.session_id DESC
       LIMIT ${RECENT_LIMIT}`,
			bindings,
			{
				lobby: '',
				session_id: 0,
				map: '',
				matchtype_id: 0,
				left_outcome: 0,
				right_outcome: 0
			}
		);

		byMode = byModeRows.map((row) => ({
			matchtypeId: Number(row.matchtype_id) || 0,
			played: Number(row.played) || 0,
			winsLeft: Number(row.wins_left) || 0,
			winsRight: Number(row.wins_right) || 0
		}));
		byMap = byMapRows.map((row) => ({
			map: String(row.map || ''),
			played: Number(row.played) || 0,
			winsLeft: Number(row.wins_left) || 0,
			winsRight: Number(row.wins_right) || 0
		}));
		recent = recentRows.map((row) => ({
			lobbyId: String(row.lobby || ''),
			sessionId: Number(row.session_id) || 0,
			map: String(row.map || ''),
			matchtypeId: Number(row.matchtype_id) || 0,
			leftOutcome: Number(row.left_outcome) === 1 ? 1 : 0,
			rightOutcome: Number(row.right_outcome) === 1 ? 1 : 0
		}));
	}

	return {
		played: Number(summary.played) || 0,
		winsLeft: Number(summary.wins_left) || 0,
		winsRight: Number(summary.wins_right) || 0,
		together: Number(togetherRows[0]?.together) || 0,
		byMode,
		byMap,
		recent
	};
}

function loadH2hBatch(meId, vsIds) {
	const empty = {};
	for (let i = 0; i < vsIds.length; i++) {
		empty[String(vsIds[i])] = { played: 0, wins: 0, losses: 0 };
	}

	if (vsIds.length === 0 || (!indexHasMeta() && !indexHasCounts())) {
		return empty;
	}

	const filters = opponentBaseFilters();
	const bindings = { meId };
	const placeholders = [];

	for (let i = 0; i < vsIds.length; i++) {
		const key = 'vs' + String(i);
		bindings[key] = vsIds[i];
		placeholders.push('{:' + key + '}');
	}

	const rows = queryAll(
		`SELECT b.profile_id AS profile_id,
       COUNT(*) AS played,
       SUM(CASE WHEN a.outcome = 1 AND b.outcome = 0 THEN 1 ELSE 0 END) AS wins,
       SUM(CASE WHEN a.outcome = 0 AND b.outcome = 1 THEN 1 ELSE 0 END) AS losses
     FROM lobby_player_index a
     JOIN lobby_player_index b ON a.lobby = b.lobby
     WHERE a.profile_id = {:meId}
       AND b.profile_id IN (${placeholders.join(', ')})
       AND ${filters.join(' AND ')}
     GROUP BY b.profile_id`,
		bindings,
		{ profile_id: 0, played: 0, wins: 0, losses: 0 }
	);

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const id = String(Number(row.profile_id));
		empty[id] = {
			played: Number(row.played) || 0,
			wins: Number(row.wins) || 0,
			losses: Number(row.losses) || 0
		};
	}

	return empty;
}

function handleCompare(e) {
	const query = e.request.url.query();
	const leftId = parseProfileId(query.get('a'));
	const rightId = parseProfileId(query.get('b'));

	if (leftId == null || rightId == null) {
		return jsonWithCors(e, 400, { message: 'a and b profile ids are required' });
	}

	if (leftId === rightId) {
		return jsonWithCors(e, 400, { message: 'a and b must be different players' });
	}

	try {
		const left = loadComparePlayer(leftId);
		const right = loadComparePlayer(rightId);
		const h2h = loadH2hPair(left.profileId, right.profileId);
		return jsonWithCors(e, 200, { left, right, h2h });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const status = error?.status || (message.includes('STEAM_API_KEY') ? 503 : 500);

		if (status === 400) {
			return jsonWithCors(e, 400, { message: 'a and b must be Relic profile ids' });
		}

		if (status === 404) {
			return jsonWithCors(e, 404, { message: 'Player not found' });
		}

		if (status === 503) {
			return jsonWithCors(e, 503, { message: 'Player compare service is not configured' });
		}

		console.warn('[player_compare] failed:', message);
		return jsonWithCors(e, 500, { message: 'Failed to compare players' });
	}
}

function handleH2hBatch(e) {
	const query = e.request.url.query();
	const meId = parseProfileId(query.get('a'));
	const vsIds = parseVsIds(query.get('vs') || '');

	if (meId == null) {
		return jsonWithCors(e, 400, { message: 'a profile id is required' });
	}

	if (vsIds.length === 0) {
		return jsonWithCors(e, 400, { message: 'vs profile ids are required' });
	}

	const filtered = vsIds.filter((id) => id !== meId);
	if (filtered.length === 0) {
		return jsonWithCors(e, 200, { a: meId, records: {} });
	}

	try {
		return jsonWithCors(e, 200, {
			a: meId,
			records: loadH2hBatch(meId, filtered)
		});
	} catch (error) {
		console.warn('[player_compare] h2h batch failed:', String(error?.message || error));
		return jsonWithCors(e, 500, { message: 'Failed to load head-to-head' });
	}
}

module.exports = {
	handleOptions,
	handleCompare,
	handleH2hBatch,
	loadH2hPair,
	loadH2hBatch,
	emptyH2h
};
