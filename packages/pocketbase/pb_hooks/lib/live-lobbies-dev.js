// Dev-only seed/clear for lobbies_live (local PocketBase).
// Seeds ranked 1v1–4v4 from recent real `lobbies` rows so aliases/profiles are authentic.
'use strict';

const { parseJsonArray } = require(`${__hooks}/lib/match-filters.js`);

const SEED_EMAIL_PREFIX = 'dev-live-lobby-';
const SEED_EMAIL_DOMAIN = '@fknoobs.com';
const SEED_PASSWORD = 'DevLiveLobbySeed1!';
const SEED_COUNT = 5;
const SEED_SESSION_BASE = 900_100_000;

const ALLOWED_ORIGINS = [
	'https://coh1stats.com',
	'https://www.coh1stats.com',
	'http://localhost:5174',
	'http://127.0.0.1:5174',
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'https://localhost:1420',
	'http://localhost:1420'
];

function applyCors(e) {
	const origin = e.request.header.get('Origin');
	if (origin && ALLOWED_ORIGINS.includes(origin)) {
		e.response.header().set('Access-Control-Allow-Origin', origin);
		e.response.header().set('Vary', 'Origin');
	}
	e.response.header().set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
	e.response.header().set('Access-Control-Allow-Headers', 'Content-Type');
}

function jsonWithCors(e, status, body) {
	applyCors(e);
	return e.json(status, body);
}

function requestHost(e) {
	try {
		const header = String(e.request.header.get('Host') || '').toLowerCase();
		if (header) {
			return header;
		}
	} catch {
		// ignore
	}

	try {
		return String(e.request.url.host || '').toLowerCase();
	} catch {
		return '';
	}
}

function isDevSeedAllowed(e) {
	const host = requestHost(e);
	if (host.includes('coh1stats.com')) {
		return false;
	}

	if (
		!host ||
		host.includes('localhost') ||
		host.includes('127.0.0.1') ||
		host.includes('[::1]') ||
		host === '::1' ||
		host.startsWith('0.0.0.0') ||
		host.includes('pocketbase')
	) {
		return true;
	}

	return String($os.getenv('ALLOW_LIVE_LOBBY_DEV_SEED') || '') === '1';
}

function seedEmail(index) {
	return `${SEED_EMAIL_PREFIX}${index}${SEED_EMAIL_DOMAIN}`;
}

function toFiniteNumber(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

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

/** Keep fields needed for live list + CurrentGameView stats; drop bulky matchHistory. */
function slimPlayersForLive(rawPlayers) {
	const raw = parseJsonArray(rawPlayers);
	const items = [];
	for (let i = 0; i < raw.length; i++) {
		const player = raw[i];
		if (!isOccupiedLobbySlot(player)) {
			continue;
		}

		const playerId = toFiniteNumber(player.playerId);
		const race = toFiniteNumber(player.race);
		const type = toFiniteNumber(player.type) ?? 0;
		const index = toFiniteNumber(player.index) ?? i;
		if (playerId == null || race == null || race < 0 || race > 3) {
			continue;
		}

		const profile = player.profile && typeof player.profile === 'object' ? player.profile : null;
		const alias = String(profile?.alias || player.name || '').trim();
		const profileId = toFiniteNumber(profile?.profile_id ?? (playerId > 0 ? playerId : null));
		const steamId = player.steamId
			? String(player.steamId)
			: typeof profile?.name === 'string' && profile.name.startsWith('/steam/')
				? profile.name.slice('/steam/'.length)
				: null;

		items.push({
			index,
			playerId,
			type,
			team: toFiniteNumber(player.team) ?? (race === 0 || race === 2 ? 0 : 1),
			race,
			name: alias || undefined,
			steamId: steamId || undefined,
			storedElo: player.storedElo,
			profile:
				playerId > 0
					? {
							profile_id: profileId != null && profileId > 0 ? profileId : playerId,
							alias: alias || undefined,
							country: profile?.country,
							level: profile?.level,
							name: profile?.name,
							personal_statgroup_id: profile?.personal_statgroup_id,
							leaderboardregion_id: profile?.leaderboardregion_id,
							xp: profile?.xp,
							// Level / Pos / W / L / Streak in CurrentGameView
							leaderboardStats: Array.isArray(profile?.leaderboardStats)
								? profile.leaderboardStats
								: undefined
						}
					: undefined
		});
	}

	return items;
}

function hostNameFromLobby(lobby, players) {
	const userId = lobby.get('user');
	if (userId) {
		try {
			const user = $app.findRecordById('users', userId);
			const name = String(user.get('name') || '').trim();
			if (name) {
				return name;
			}
		} catch {
			// fall through
		}
	}

	for (let i = 0; i < players.length; i++) {
		const alias = String(players[i]?.profile?.alias || players[i]?.name || '').trim();
		if (alias) {
			return alias;
		}
	}

	return `Dev lobby ${lobby.id}`;
}

/** Relic ranked automatch titles → matchType 1–4. */
function matchTypeFromTitle(title) {
	const normalized = String(title || '')
		.trim()
		.toUpperCase()
		.replace(/\s+/g, ' ');
	if (normalized === '1 VS. 1') {
		return 1;
	}
	if (normalized === '2 VS. 2') {
		return 2;
	}
	if (normalized === '3 VS. 3') {
		return 3;
	}
	if (normalized === '4 VS. 4') {
		return 4;
	}
	return null;
}

function matchTypeFromHumans(humans) {
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
	return null;
}

function rankedMatchType(lobby, humans) {
	return matchTypeFromTitle(lobby.get('title')) ?? matchTypeFromHumans(humans);
}

function pickSourceLobbies(limit) {
	let records = [];
	try {
		// Prefer real ranked automatch rows (1v1–4v4), not custom "Basic Match".
		records = $app.findRecordsByFilter(
			'lobbies',
			'isRanked = true && (title = "1 VS. 1" || title = "2 VS. 2" || title = "3 VS. 3" || title = "4 VS. 4")',
			'-createdAt',
			Math.max(limit * 12, 60),
			0
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('[live_lobbies_dev] lobbies query failed:', message);
		return [];
	}

	const seedSessionMin = SEED_SESSION_BASE + 1;
	const seedSessionMax = SEED_SESSION_BASE + SEED_COUNT + 10;
	const seenSession = {};
	const seenMatchType = {};
	const picked = [];
	const overflow = [];
	for (let i = 0; i < records.length; i++) {
		const lobby = records[i];
		const sessionId = String(lobby.get('sessionId') || '');
		const sessionNum = toFiniteNumber(lobby.get('sessionId'));
		if (!sessionId || seenSession[sessionId]) {
			continue;
		}

		// Skip durable rows created by a previous seed run.
		if (sessionNum != null && sessionNum >= seedSessionMin && sessionNum <= seedSessionMax) {
			continue;
		}

		const players = slimPlayersForLive(lobby.get('players'));
		const humans = players.filter((player) => player.playerId > 0);
		const matchType = rankedMatchType(lobby, humans);
		if (matchType == null || humans.length < 2) {
			continue;
		}

		seenSession[sessionId] = true;
		const entry = { lobby, players, matchType };
		if (!seenMatchType[matchType]) {
			seenMatchType[matchType] = true;
			picked.push(entry);
		} else {
			overflow.push(entry);
		}

		if (picked.length >= limit) {
			break;
		}
	}

	for (let i = 0; i < overflow.length && picked.length < limit; i++) {
		picked.push(overflow[i]);
	}

	return picked;
}

function ensureSeedUser(index, name) {
	const email = seedEmail(index);
	try {
		const existing = $app.findFirstRecordByFilter('users', `email = "${email}"`);
		if (existing.get('name') !== name) {
			existing.set('name', name);
			$app.save(existing);
		}
		return existing;
	} catch {
		const collection = $app.findCollectionByNameOrId('users');
		const record = new Record(collection);
		record.set('email', email);
		record.set('emailVisibility', false);
		record.set('verified', true);
		record.set('name', name);
		record.setPassword(SEED_PASSWORD);
		record.set('passwordConfirm', SEED_PASSWORD);
		$app.save(record);
		return record;
	}
}

function upsertLiveLobby(userId, payload) {
	const collection = $app.findCollectionByNameOrId('lobbies_live');
	let record;
	try {
		record = $app.findFirstRecordByFilter('lobbies_live', `user = "${userId}"`);
	} catch {
		record = new Record(collection);
		record.set('user', userId);
	}

	record.set('sessionId', payload.sessionId);
	record.set('map', payload.map);
	record.set('isRanked', payload.isRanked);
	record.set('matchType', payload.matchType);
	record.set('isReplay', false);
	record.set('players', payload.players);
	if (payload.lobbyId) {
		record.set('lobby', payload.lobbyId);
	}
	$app.save(record);
	return record;
}

function rankedTitle(matchType) {
	if (matchType >= 1 && matchType <= 4) {
		return `${matchType} VS. ${matchType}`;
	}

	return '1 VS. 1';
}

/** Durable in-progress lobbies row so Details can open /replays/{id}. */
function ensureSeedLobby(payload) {
	const sessionId = payload.sessionId;
	const title = payload.title || rankedTitle(payload.matchType);
	try {
		const existing = $app.findFirstRecordByFilter('lobbies', `sessionId = ${sessionId}`);
		existing.set('map', payload.map);
		existing.set('isRanked', payload.isRanked);
		existing.set('title', title);
		existing.set('needsResult', true);
		existing.set('players', payload.players);
		if (payload.userId) {
			existing.set('user', payload.userId);
		}
		$app.save(existing);
		return existing;
	} catch {
		const collection = $app.findCollectionByNameOrId('lobbies');
		const record = new Record(collection);
		record.set('user', payload.userId);
		record.set('sessionId', sessionId);
		record.set('map', payload.map);
		record.set('isRanked', payload.isRanked);
		record.set('title', title);
		record.set('needsResult', true);
		record.set('players', payload.players);
		$app.save(record);
		return record;
	}
}

function clearSeededLiveLobbies() {
	let deleted = 0;
	for (let i = 1; i <= SEED_COUNT + 10; i++) {
		const email = seedEmail(i);
		let user;
		try {
			user = $app.findFirstRecordByFilter('users', `email = "${email}"`);
		} catch {
			continue;
		}

		try {
			const lobby = $app.findFirstRecordByFilter('lobbies_live', `user = "${user.id}"`);
			$app.delete(lobby);
			deleted++;
		} catch {
			// no live row for this seed user
		}

		const sessionId = SEED_SESSION_BASE + i;
		try {
			const durable = $app.findFirstRecordByFilter('lobbies', `sessionId = ${sessionId}`);
			$app.delete(durable);
		} catch {
			// no seeded durable row
		}
	}

	return deleted;
}

function handleOptions(e) {
	applyCors(e);
	return e.noContent(204);
}

function handleSeed(e) {
	if (!isDevSeedAllowed(e)) {
		return jsonWithCors(e, 403, {
			message: 'Dev live-lobby seed is only allowed on local PocketBase.'
		});
	}

	try {
		const sources = pickSourceLobbies(SEED_COUNT);
		if (sources.length === 0) {
			return jsonWithCors(e, 404, {
				message: 'No suitable lobbies found to seed from.'
			});
		}

		clearSeededLiveLobbies();

		const items = [];
		for (let i = 0; i < sources.length; i++) {
			const { lobby, players, matchType } = sources[i];
			const hostName = hostNameFromLobby(lobby, players);
			const user = ensureSeedUser(i + 1, hostName);
			const sessionId = SEED_SESSION_BASE + i + 1;
			const map = String(lobby.get('map') || '');
			const title = rankedTitle(matchType);
			const durable = ensureSeedLobby({
				userId: user.id,
				sessionId,
				map,
				isRanked: true,
				matchType,
				title,
				players
			});
			const record = upsertLiveLobby(user.id, {
				sessionId,
				map,
				isRanked: true,
				matchType,
				players,
				lobbyId: durable.id
			});
			items.push({
				id: record.id,
				lobbyId: durable.id,
				sessionId,
				map,
				matchType,
				hostName,
				sourceLobbyId: lobby.id,
				players: players.length
			});
		}

		return jsonWithCors(e, 200, { ok: true, count: items.length, items });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('[live_lobbies_dev] seed failed:', message);
		return jsonWithCors(e, 500, { message: 'Failed to seed live lobbies' });
	}
}

function handleClear(e) {
	if (!isDevSeedAllowed(e)) {
		return jsonWithCors(e, 403, {
			message: 'Dev live-lobby seed is only allowed on local PocketBase.'
		});
	}

	try {
		const deleted = clearSeededLiveLobbies();
		return jsonWithCors(e, 200, { ok: true, deleted });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('[live_lobbies_dev] clear failed:', message);
		return jsonWithCors(e, 500, { message: 'Failed to clear seeded live lobbies' });
	}
}

module.exports = {
	handleOptions,
	handleSeed,
	handleClear
};
