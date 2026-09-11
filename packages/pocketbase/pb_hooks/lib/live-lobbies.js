// Public live companion lobbies for coh1stats.com.
// Thin HTTP shim: same filter/dedupe/slim as the companion collection read.
// Stats/Elo for the website come from embedded player fields via packages/ui
// (website LiveLobbiesService). Do not query the lobbies table or player_ratings
// on the list path — that made /api/live-lobbies take 15s+.
'use strict';

const { LOBBIES_LIVE_STALE_MS } = require(`${__hooks}/lib/lobbies-live.js`);
const { parseJsonArray } = require(`${__hooks}/lib/match-filters.js`);
const {
	getStoredEloForLeaderboard,
	isValidSteamId
} = require(`${__hooks}/lib/player-ratings.js`);

const ALLOWED_ORIGINS = [
	'https://coh1stats.com',
	'https://www.coh1stats.com',
	'http://localhost:5174',
	'http://127.0.0.1:5174'
];
const LIST_LIMIT = 48;
const HTTP_CACHE_CONTROL = 'public, max-age=10, s-maxage=15, stale-while-revalidate=60';

function applyCors(e) {
	const origin = e.request.header.get('Origin');
	if (origin && ALLOWED_ORIGINS.includes(origin)) {
		e.response.header().set('Access-Control-Allow-Origin', origin);
		e.response.header().set('Vary', 'Origin');
	}
	e.response.header().set('Access-Control-Allow-Methods', 'GET, OPTIONS');
	e.response.header().set('Access-Control-Allow-Headers', 'Content-Type');
}

function jsonWithCors(e, status, body, cacheControl) {
	applyCors(e);
	if (cacheControl) {
		e.response.header().set('Cache-Control', cacheControl);
	}
	return e.json(status, body);
}

function toFiniteNumber(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

/**
 * Relic logs closed/empty slots as Id -1 with Type 3 or 6.
 * Real skirmish AI is Id -1 with Type 1. Replay placeholders use Id 0.
 * Nested matchHistory[].players members have profile_id/race_id, not playerId.
 * Keep in sync with packages/ui/src/live-lobby/slim.ts.
 */
function isOccupiedLobbySlot(player) {
	if (!player || typeof player !== 'object' || Array.isArray(player)) {
		return false;
	}
	if (player.race_id != null && player.playerId == null && player.type == null) {
		return false;
	}
	const playerId = toFiniteNumber(player.playerId);
	if (playerId == null) {
		return false;
	}
	if (playerId === -1) {
		return toFiniteNumber(player.type) === 1;
	}
	if (playerId === 0) {
		return false;
	}
	return true;
}

function slimPlayer(player, fallbackIndex) {
	const playerId = toFiniteNumber(player.playerId);
	let race = toFiniteNumber(player.race);
	const type = toFiniteNumber(player.type);
	const index = toFiniteNumber(player.index) ?? fallbackIndex;
	const teamRaw = toFiniteNumber(player.team);
	const team = teamRaw === 0 || teamRaw === 1 ? teamRaw : null;
	if (playerId == null) {
		return null;
	}
	// Unresolved Race 6 (random): place by Relic team when known; AI otherwise Allies.
	if (race == null || race < 0 || race > 3) {
		if (team != null) {
			race = team === 1 ? 1 : 0;
		} else if (playerId === -1) {
			race = 0;
		} else {
			return null;
		}
	}
	const profileIdRaw = player?.profile?.profile_id ?? (playerId > 0 ? playerId : null);
	const profileId = toFiniteNumber(profileIdRaw);
	const alias = String(player?.profile?.alias || player?.name || '').trim();
	const country = String(player?.profile?.country || '').trim() || null;
	const slim = {
		index,
		playerId,
		type: type ?? 0,
		race,
		alias,
		profileId: profileId != null && profileId > 0 ? profileId : null,
		steamId: player?.steamId ? String(player.steamId) : null,
		country
	};
	if (team != null) {
		slim.team = team;
	}
	return slim;
}

function slimPlayerPairs(value) {
	const raw = parseJsonArray(value);
	const seenSlot = {};
	const pairs = [];
	for (let i = 0; i < raw.length; i++) {
		const player = raw[i];
		if (!isOccupiedLobbySlot(player)) {
			continue;
		}
		const slim = slimPlayer(player, i);
		if (!slim) {
			continue;
		}
		const slot = slim.index;
		if (slot >= 0 && slot <= 7) {
			if (seenSlot[slot]) {
				continue;
			}
			seenSlot[slot] = true;
		}
		pairs.push({ slim, raw: player });
		if (pairs.length >= 8) {
			break;
		}
	}
	return pairs;
}

function slimPlayers(value) {
	return slimPlayerPairs(value).map(function (pair) {
		return pair.slim;
	});
}

/**
 * Maps a basic (0), ranked 1v1-4v4 (1-4), or skirmish (14) match type + race to
 * its Relic leaderboard id. Keep in sync with packages/ui/src/live-lobby/stats.ts.
 */
function leaderboardIdForMatchRace(matchTypeId, race) {
	if (!Number.isInteger(race) || race < 0 || race > 3) {
		return null;
	}
	if (matchTypeId === 14) {
		return 42 + race;
	}
	if (!Number.isInteger(matchTypeId) || matchTypeId < 0 || matchTypeId > 4) {
		return null;
	}
	return matchTypeId * 4 + race;
}

/** Keep in sync with getLiveLobbyMatchTypeId in packages/ui/src/live-lobby/slim.ts. */
function liveLobbyMatchTypeId(players, isRanked, matchType) {
	if (matchType === 14) {
		return 14;
	}
	for (let i = 0; i < players.length; i++) {
		if (players[i].playerId === -1) {
			return 14;
		}
	}
	// Custom / unranked always Basic Match — ignore size-like matchType 1–4.
	if (!isRanked) {
		return 0;
	}
	if (typeof matchType === 'number' && matchType >= 0 && matchType <= 4) {
		return matchType;
	}
	const humans = players.filter(function (player) {
		return player.playerId !== -1;
	});
	if (humans.length === 2) {
		return 1;
	}
	if (humans.length === 4) {
		return 2;
	}
	if (humans.length === 6) {
		return 3;
	}
	if (humans.length === 8) {
		return 4;
	}
	return 0;
}

function resolveStoredElo(player, matchTypeId, race) {
	const storedElo = player && player.storedElo;
	if (!storedElo || typeof storedElo !== 'object') {
		return null;
	}
	const group = storedElo[String(matchTypeId)];
	if (!group || typeof group !== 'object') {
		return null;
	}
	const slot = group[String(race)];
	const rating = slot ? Number(slot.rating) : NaN;
	return Number.isFinite(rating) && rating >= 1 ? rating : null;
}

function loadPlayerRatingsElo(steamId) {
	if (!isValidSteamId(steamId)) {
		return null;
	}
	// Prefer SQL text — record.get('elo') can be a goja byte array that eloToMap misreads.
	try {
		const row = new DynamicModel({ elo: '' });
		$app
			.db()
			.newQuery(
				`SELECT COALESCE(elo, '') AS elo
				FROM player_ratings
				WHERE steamId = {:steamId}
				LIMIT 1`
			)
			.bind({ steamId })
			.one(row);
		return row.elo || null;
	} catch {
		return null;
	}
}

/** Prefer lobby-embedded storedElo; fall back to player_ratings (match detail only). */
function resolvePlayerElo(player, matchTypeId, race, eloCache) {
	const fromStored = resolveStoredElo(player, matchTypeId, race);
	if (fromStored != null) {
		return fromStored;
	}

	const steamId = player && player.steamId ? String(player.steamId) : '';
	if (!steamId) {
		return null;
	}

	if (!Object.prototype.hasOwnProperty.call(eloCache, steamId)) {
		eloCache[steamId] = loadPlayerRatingsElo(steamId);
	}

	const leaderboardId = leaderboardIdForMatchRace(matchTypeId, race);
	if (leaderboardId == null) {
		return null;
	}

	return getStoredEloForLeaderboard(eloCache[steamId], leaderboardId);
}

function pickPlayerStats(player, matchTypeId, eloCache) {
	const race = toFiniteNumber(player.race);
	if (race == null) {
		return null;
	}
	const leaderboardId = leaderboardIdForMatchRace(matchTypeId, race);
	const stats = player && player.profile && player.profile.leaderboardStats;
	let stat = null;
	if (leaderboardId != null && Array.isArray(stats)) {
		for (let i = 0; i < stats.length; i++) {
			if (toFiniteNumber(stats[i].leaderboard_id) === leaderboardId) {
				stat = stats[i];
				break;
			}
		}
	}
	const elo = resolvePlayerElo(player, matchTypeId, race, eloCache);
	const resolvedElo = elo != null ? elo : matchTypeId === 14 ? 1000 : null;
	if (!stat && resolvedElo == null) {
		return null;
	}
	return {
		elo: resolvedElo,
		wins: stat ? (toFiniteNumber(stat.wins) ?? 0) : 0,
		losses: stat ? (toFiniteNumber(stat.losses) ?? 0) : 0,
		streak: stat ? (toFiniteNumber(stat.streak) ?? 0) : 0,
		rank: stat ? (toFiniteNumber(stat.rank) ?? 0) : 0,
		rankLevel: stat ? (toFiniteNumber(stat.ranklevel) ?? 0) : 0
	};
}

/** Used by match.js for in-progress replay pages — may hit player_ratings. */
function detailPlayers(value, isRanked, eloCache, matchType) {
	const pairs = slimPlayerPairs(value);
	const slimList = pairs.map(function (pair) {
		return pair.slim;
	});
	const matchTypeId = liveLobbyMatchTypeId(slimList, isRanked, matchType);
	const cache = eloCache || {};
	return pairs.map(function (pair) {
		const stats = pickPlayerStats(pair.raw, matchTypeId, cache);
		if (!stats) {
			return pair.slim;
		}
		return Object.assign({}, pair.slim, { stats });
	});
}

function hostName(userId) {
	if (!userId) {
		return '';
	}
	try {
		const user = $app.findRecordById('users', userId);
		return String(user.get('name') || '').trim();
	} catch {
		return '';
	}
}

/** Relation only — never scan the lobbies table. */
function resolveLobbyId(record) {
	const linked = record.get('lobby');
	if (typeof linked === 'string' && linked) {
		return linked;
	}
	if (linked && typeof linked === 'object' && linked.id) {
		return String(linked.id);
	}

	return null;
}

function toPublicItem(record, host) {
	const players = slimPlayers(record.get('players'));
	const isRanked = Boolean(record.get('isRanked'));
	const matchType = liveLobbyMatchTypeId(
		players,
		isRanked,
		toFiniteNumber(record.get('matchType'))
	);
	return {
		id: record.id,
		lobbyId: resolveLobbyId(record),
		sessionId: String(record.get('sessionId') || ''),
		map: String(record.get('map') || ''),
		isRanked,
		matchType,
		createdAt: String(record.get('createdAt') || ''),
		updatedAt: String(record.get('updatedAt') || ''),
		hostName: host,
		players
	};
}

function isPublicLiveLobby(record) {
	if (record.get('isReplay')) {
		return false;
	}

	const updatedAt = new Date(String(record.get('updatedAt') || '')).getTime();
	return Number.isFinite(updatedAt) && Date.now() - updatedAt < LOBBIES_LIVE_STALE_MS;
}

function getPublicLobby(id) {
	let record;
	try {
		record = $app.findRecordById('lobbies_live', id);
	} catch {
		return null;
	}

	if (!isPublicLiveLobby(record)) {
		return null;
	}

	return toPublicItem(record, hostName(record.get('user')));
}

function listPublicLobbies() {
	const since = new Date(Date.now() - LOBBIES_LIVE_STALE_MS).toISOString().replace('T', ' ');
	let records = [];
	try {
		records = $app.findRecordsByFilter(
			'lobbies_live',
			`updatedAt > "${since}" && isReplay != true`,
			'-updatedAt',
			LIST_LIMIT,
			0
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('[live_lobbies] findRecordsByFilter failed:', message);
		return [];
	}

	const seen = {};
	const items = [];
	for (let i = 0; i < records.length; i++) {
		const record = records[i];
		const sessionId = String(record.get('sessionId') || '');
		if (!sessionId || seen[sessionId]) {
			continue;
		}

		seen[sessionId] = true;
		items.push(toPublicItem(record, hostName(record.get('user'))));
	}

	return items;
}

function handleOptions(e) {
	applyCors(e);
	return e.noContent(204);
}

function handleList(e) {
	try {
		return jsonWithCors(e, 200, { items: listPublicLobbies() }, HTTP_CACHE_CONTROL);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('[live_lobbies] list failed:', message);
		return jsonWithCors(e, 500, { message: 'Failed to load live lobbies' });
	}
}

function handleGet(e) {
	try {
		const lobby = getPublicLobby(e.request.pathValue('id'));
		if (!lobby) {
			return jsonWithCors(e, 404, { message: 'Live lobby not found' });
		}

		return jsonWithCors(e, 200, lobby, HTTP_CACHE_CONTROL);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('[live_lobbies] get failed:', message);
		return jsonWithCors(e, 500, { message: 'Failed to load live lobby' });
	}
}

module.exports = {
	handleOptions,
	handleList,
	handleGet,
	detailPlayers
};
