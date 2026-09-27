'use strict';

const COLLECTION = 'player_ratings';
const STEAM_ID_REGEX = /^7656119\d{10}$/;
const MIN_STORED_MATCH_TYPE = 0;
const MAX_STORED_MATCH_TYPE = 7;
const MAX_INGEST_PLAYERS = 64;
const LOBBY_FILL_LIMIT = 200;
const LOBBY_FILL_BATCH_SIZE = 8;
const MAX_ELO_SLOTS = 32;
const ELO_HISTORY_LIMIT = 500;

function isServiceRequest(e) {
	const token = $os.getenv('SMURF_SERVICE_TOKEN') || '';
	if (!token) {
		return false;
	}

	const auth = e.request.header.get('Authorization') || '';
	return auth === `Bearer ${token}`;
}

function readRequestJsonBody(e) {
	try {
		const body = e.requestInfo()?.body;
		if (body && typeof body === 'object' && Object.keys(body).length > 0) {
			return body;
		}
	} catch (error) {
		console.log('[player_ratings] failed to read requestInfo body', String(error));
	}

	try {
		const raw = toString(e.request.body);
		if (raw) {
			return JSON.parse(raw);
		}
	} catch (error) {
		console.log('[player_ratings] failed to parse raw request body', String(error));
	}

	return {};
}

function asList(raw) {
	if (Array.isArray(raw)) {
		return raw;
	}

	if (typeof raw === 'string') {
		try {
			return asList(JSON.parse(raw));
		} catch {
			return [];
		}
	}

	if (raw && typeof raw === 'object') {
		return Object.keys(raw)
			.filter((key) => String(Number(key)) === key)
			.sort((a, b) => Number(a) - Number(b))
			.map((key) => raw[key]);
	}

	return [];
}

function keyedEntries(value) {
	if (Array.isArray(value)) {
		return value.map((item, index) => [String(index), item]);
	}

	if (value && typeof value === 'object') {
		return Object.entries(value);
	}

	return [];
}

function normalizeKeyedContainer(value) {
	if (value == null) {
		return {};
	}

	if (Array.isArray(value)) {
		const obj = {};
		for (let i = 0; i < value.length; i++) {
			if (value[i] != null) {
				obj[String(i)] = value[i];
			}
		}
		return obj;
	}

	if (typeof value === 'object') {
		return value;
	}

	return {};
}

function eloToMap(raw) {
	const parsed = normalizeKeyedContainer(parseJson(raw, {}) || {});
	const next = {};

	for (const [matchKey, races] of Object.entries(normalizeKeyedContainer(parsed))) {
		const group = {};

		for (const [raceKey, slot] of Object.entries(normalizeKeyedContainer(races))) {
			if (!slot || typeof slot !== 'object') {
				continue;
			}

			const rating = Number(slot.rating);
			const matchId = Number(slot.matchId ?? slot.match_id);
			const at = Number(slot.at);
			if (!Number.isFinite(rating) || rating < 1) {
				continue;
			}

			const current = group[raceKey];
			if (!current || at > Number(current.at || 0)) {
				group[raceKey] = { rating, matchId, at };
			}
		}

		if (Object.keys(group).length > 0) {
			next[matchKey] = group;
		}
	}

	return next;
}

function isStoredMatchType(matchtypeId) {
	const id = Number(matchtypeId);
	return Number.isInteger(id) && id >= MIN_STORED_MATCH_TYPE && id <= MAX_STORED_MATCH_TYPE;
}

function isValidSteamId(value) {
	return typeof value === 'string' && STEAM_ID_REGEX.test(value);
}

function matchTypeIdFromLeaderboardId(leaderboardId) {
	const id = Number(leaderboardId);
	if (id >= 0 && id <= 3) return 0;
	if (id >= 4 && id <= 7) return 1;
	if (id >= 8 && id <= 11) return 2;
	if (id >= 12 && id <= 15) return 3;
	if (id >= 16 && id <= 19) return 4;
	return null;
}

function raceIdFromLeaderboardId(leaderboardId) {
	const id = Number(leaderboardId);
	// Relic packs race as id % 4 within each mode block (basic 0-3, 1v1 4-7, …).
	if (Number.isInteger(id) && id >= 0 && id <= 19) {
		return id % 4;
	}
	return null;
}

function getStoredEloForLeaderboard(elo, leaderboardId) {
	const matchType = matchTypeIdFromLeaderboardId(leaderboardId);
	const raceId = raceIdFromLeaderboardId(leaderboardId);
	if (matchType == null || raceId == null) {
		return null;
	}

	const map = eloToMap(elo);
	const slot = map[String(matchType)]?.[String(raceId)];
	if (!slot || typeof slot.rating !== 'number' || slot.rating < 1) {
		return null;
	}

	return slot.rating;
}

function parseJson(raw, fallback) {
	if (raw == null || raw === '') {
		return fallback;
	}

	if (typeof raw === 'object') {
		return raw;
	}

	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw);
		} catch {
			return fallback;
		}
	}

	return fallback;
}

function normalizeSlot(raw) {
	const matchtypeId = Number(raw?.matchtypeId ?? raw?.matchtype_id);
	const raceId = Number(raw?.raceId ?? raw?.race_id);
	const rating = Number(raw?.rating ?? raw?.newrating);
	const matchId = Number(raw?.matchId ?? raw?.match_id ?? raw?.id);
	let at = Number(raw?.at ?? raw?.completiontime ?? 0);

	if (!isStoredMatchType(matchtypeId)) {
		return null;
	}

	if (!Number.isInteger(raceId) || raceId < 0 || raceId > 3) {
		return null;
	}

	if (!Number.isFinite(rating) || rating < 1) {
		return null;
	}

	if (!Number.isFinite(matchId) || matchId <= 0) {
		return null;
	}

	if (!Number.isFinite(at) || at < 0) {
		return null;
	}

	// Cap far-future timestamps so a client cannot lock a slot forever.
	const nowSec = Math.floor(Date.now() / 1000);
	if (at > nowSec + 60) {
		at = nowSec;
	}

	return { matchtypeId, raceId, rating, matchId, at };
}

function mergeElo(existing, slots) {
	const next = eloToMap(existing);

	for (const slot of slots) {
		const matchKey = String(slot.matchtypeId);
		const raceKey = String(slot.raceId);
		const currentGroup =
			next[matchKey] && typeof next[matchKey] === 'object' ? { ...next[matchKey] } : {};
		const current = currentGroup[raceKey];

		if (!current || slot.at > Number(current.at || 0)) {
			currentGroup[raceKey] = {
				rating: slot.rating,
				matchId: slot.matchId,
				at: slot.at
			};
			next[matchKey] = currentGroup;
		}
	}

	return next;
}

function loadEloRawFromDb(steamId) {
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
		return row.elo;
	} catch {
		return null;
	}
}

function readEloFromRecord(record) {
	if (!record) {
		return {};
	}

	const fromField = eloToMap(record.get('elo'));
	if (Object.keys(fromField).length > 0) {
		return fromField;
	}

	const steamId = record.get('steamId');
	if (!isValidSteamId(steamId)) {
		return {};
	}

	return eloToMap(loadEloRawFromDb(steamId));
}

function serializeRecord(record) {
	if (!record) {
		return null;
	}

	return {
		id: record.id,
		steamId: record.get('steamId'),
		profileId: record.get('profileId'),
		alias: record.get('alias'),
		elo: readEloFromRecord(record),
		harvestedAt: record.get('harvestedAt') || null
	};
}

function findBySteamId(steamId) {
	try {
		return $app.findFirstRecordByFilter(COLLECTION, 'steamId = {:steamId}', { steamId });
	} catch {
		return null;
	}
}

function findByProfileId(profileId) {
	const id = Number(profileId);
	if (!Number.isInteger(id) || id <= 0) {
		return null;
	}

	try {
		return $app.findFirstRecordByFilter(COLLECTION, 'profileId = {:profileId}', { profileId: id });
	} catch {
		return null;
	}
}

function countEloSlots(raw) {
	const map = typeof raw === 'object' && raw !== null && !Array.isArray(raw) && !raw.rating
		? raw
		: eloToMap(raw);
	return countEloSlotsFromMap(map);
}

function countEloSlotsFromMap(map) {
	let count = 0;

	for (const matchKey of Object.keys(map || {})) {
		count += Object.keys(map[matchKey] || {}).length;
	}

	return count;
}

function eloHasGaps(raw) {
	return countEloSlots(raw) < MAX_ELO_SLOTS;
}

function hasLobbyIndexSteamId() {
	try {
		const collection = $app.findCollectionByNameOrId('lobby_player_index');
		return Boolean(collection.fields.getByName('steam_id'));
	} catch {
		return false;
	}
}

function resolveProfileIdForSteamId(steamId, profileIdHint) {
	const hinted = Number(profileIdHint);
	if (Number.isInteger(hinted) && hinted > 0) {
		return hinted;
	}

	const record = findBySteamId(steamId);
	const fromRecord = Number(record?.get('profileId'));
	if (Number.isInteger(fromRecord) && fromRecord > 0) {
		return fromRecord;
	}

	return null;
}

function collectLobbyResults(rows) {
	const results = [];
	for (const row of rows) {
		const result = row.result;
		if (typeof result === 'string' && result && result !== 'null') {
			results.push(result);
		}
	}

	return results;
}

function queryLobbyResultsByProfileId(profileId, limit) {
	const rows = arrayOf(
		new DynamicModel({
			result: ''
		})
	);

	$app
		.db()
		.newQuery(
			`SELECT COALESCE(l.result, '') AS result
			FROM lobby_player_index i
			INNER JOIN lobbies l ON l.id = i.lobby
			WHERE i.profile_id = {:profileId}
				AND l.result IS NOT NULL
				AND l.result != ''
				AND l.result != 'null'
				AND COALESCE(l.title, '') != 'Skirmish'
			ORDER BY COALESCE(l.sessionId, 0) DESC, l.createdAt DESC
			LIMIT {:limit}`
		)
		.bind({ profileId, limit })
		.all(rows);

	return collectLobbyResults(rows);
}

function queryLobbyResultsBySteamId(steamId, limit) {
	const rows = arrayOf(
		new DynamicModel({
			result: ''
		})
	);

	$app
		.db()
		.newQuery(
			`SELECT COALESCE(l.result, '') AS result
			FROM lobby_player_index i
			INNER JOIN lobbies l ON l.id = i.lobby
			WHERE i.steam_id = {:steamId}
				AND l.result IS NOT NULL
				AND l.result != ''
				AND l.result != 'null'
				AND COALESCE(l.title, '') != 'Skirmish'
			ORDER BY COALESCE(l.sessionId, 0) DESC, l.createdAt DESC
			LIMIT {:limit}`
		)
		.bind({ steamId, limit })
		.all(rows);

	return collectLobbyResults(rows);
}

function loadLobbyResultsForSteamId(steamId, limit, profileIdHint) {
	try {
		let results = [];

		if (hasLobbyIndexSteamId()) {
			results = queryLobbyResultsBySteamId(steamId, limit);
		}

		if (results.length === 0) {
			const profileId = resolveProfileIdForSteamId(steamId, profileIdHint);
			if (profileId != null) {
				results = queryLobbyResultsByProfileId(profileId, limit);
			}
		}

		return results;
	} catch (error) {
		console.log('[player_ratings] lobby fill query failed', steamId, String(error));
		return [];
	}
}

function fillFromLobbies(steamId, profileIdHint) {
	if (!isValidSteamId(steamId)) {
		return { processed: 0, updated: 0, failed: false };
	}

	try {
		const results = loadLobbyResultsForSteamId(steamId, LOBBY_FILL_LIMIT, profileIdHint);
		let updated = 0;

		for (const result of results) {
			try {
				const records = ingestLobbyResult(result);
				if (records.length > 0) {
					updated += 1;
				}
			} catch (error) {
				console.log('[player_ratings] lobby fill ingest failed', steamId, String(error));
			}
		}

		return { processed: results.length, updated, failed: false };
	} catch (error) {
		console.log('[player_ratings] lobby fill failed', steamId, String(error));
		return { processed: 0, updated: 0, failed: true };
	}
}

const LOBBY_FILL_JOB_ID = 'player_ratings_lobby_fill';
const LOBBY_FILL_SCAN_SIZE = 256;

function selectPlayersForLobbyFill(limit) {
	const jobState = require(`${__hooks}/lib/job-state.js`);
	const page = Math.max(1, jobState.getPage(LOBBY_FILL_JOB_ID) || 1);
	const offset = (page - 1) * LOBBY_FILL_SCAN_SIZE;
	const rows = arrayOf(
		new DynamicModel({
			steamId: '',
			profileId: 0,
			elo: ''
		})
	);

	$app
		.db()
		.newQuery(
			`SELECT steamId, profileId, COALESCE(elo, '') AS elo
			FROM player_ratings
			WHERE steamId IS NOT NULL
				AND steamId != ''
			ORDER BY steamId ASC
			LIMIT {:limit} OFFSET {:offset}`
		)
		.bind({ limit: LOBBY_FILL_SCAN_SIZE, offset })
		.all(rows);

	if (rows.length < LOBBY_FILL_SCAN_SIZE) {
		jobState.setPage(LOBBY_FILL_JOB_ID, 1);
	} else {
		jobState.setPage(LOBBY_FILL_JOB_ID, page + 1);
	}

	const candidates = [];
	for (const row of rows) {
		if (!isValidSteamId(row.steamId) || !eloHasGaps(row.elo)) {
			continue;
		}

		candidates.push({
			steamId: row.steamId,
			profileId: row.profileId,
			slots: countEloSlots(row.elo)
		});
	}

	candidates.sort((a, b) => a.slots - b.slots);
	return candidates.slice(0, limit);
}

function runLobbyFillBatch() {
	const players = selectPlayersForLobbyFill(LOBBY_FILL_BATCH_SIZE);
	let processed = 0;
	let updated = 0;

	for (const player of players) {
		const result = fillFromLobbies(player.steamId, player.profileId);
		processed += result.processed;
		updated += result.updated;
	}

	return { players: players.length, processed, updated };
}

function upsertPlayerRating({ steamId, profileId, alias, slots }) {
	if (!isValidSteamId(steamId) || !slots?.length) {
		return null;
	}

	const resolvedProfileId = Number(profileId);
	if (!Number.isInteger(resolvedProfileId) || resolvedProfileId <= 0) {
		return null;
	}

	const existing = findBySteamId(steamId);
	const incomingAlias = typeof alias === 'string' ? alias.trim() : '';
	const resolvedAlias =
		incomingAlias || (existing ? String(existing.get('alias') || '').trim() : '');
	if (!resolvedAlias) {
		return null;
	}

	const merged = mergeElo(readEloFromRecord(existing), slots);

	if (existing) {
		existing.set('profileId', resolvedProfileId);
		existing.set('alias', resolvedAlias);
		existing.set('elo', merged);
		$app.save(existing);
		return existing;
	}

	const collection = $app.findCollectionByNameOrId(COLLECTION);
	const record = new Record(collection);
	record.set('steamId', steamId);
	record.set('profileId', resolvedProfileId);
	record.set('alias', resolvedAlias);
	record.set('elo', merged);
	$app.save(record);
	return record;
}

function extractPlayersFromMatch(result) {
	const match = parseJson(result, null);
	if (!match || !isStoredMatchType(match.matchtype_id)) {
		return [];
	}

	const at = Number(match.completiontime ?? match.startgametime ?? 0);
	const matchId = Number(match.id);
	const players = asList(match.players);
	const bySteam = {};

	for (const player of players) {
		const steamId = player?.steamId || (typeof player?.name === 'string' ? player.name.replace('/steam/', '') : '');
		const slot = normalizeSlot({
			matchtypeId: match.matchtype_id,
			raceId: player?.race_id,
			rating: player?.newrating,
			matchId,
			at
		});

		if (!isValidSteamId(steamId) || !slot) {
			continue;
		}

		bySteam[steamId] = {
			steamId,
			profileId: player?.profile_id,
			alias: player?.alias,
			slots: [slot]
		};
	}

	return Object.values(bySteam);
}

function upsertSnapshotSlot(slots, slot) {
	const existing = slots.find(
		(item) => item.matchtypeId === slot.matchtypeId && item.raceId === slot.raceId
	);

	if (!existing) {
		slots.push(slot);
		return;
	}

	if (slot.at > existing.at) {
		existing.rating = slot.rating;
		existing.matchId = slot.matchId;
		existing.at = slot.at;
	}
}

function ingestPlayerList(players) {
	const records = [];

	for (const player of players) {
		try {
			const record = upsertPlayerRating(player);
			if (record) {
				records.push(record);
			}
		} catch (error) {
			console.log('[player_ratings] upsert failed', player.steamId, String(error));
		}
	}

	return records;
}

function ingestLobbyResult(result) {
	return ingestPlayerList(extractPlayersFromMatch(result));
}

function ingestTransformedMatches(matches) {
	const bySteam = {};

	for (const match of asList(matches)) {
		if (!isStoredMatchType(match?.matchtype_id)) {
			continue;
		}

		const at = Number(match.completiontime ?? match.startgametime ?? 0);
		const matchId = Number(match.id);

		for (const player of asList(match.players)) {
			const steamId =
				player?.steamId ||
				(typeof player?.name === 'string' ? player.name.replace('/steam/', '') : '');
			const slot = normalizeSlot({
				matchtypeId: match.matchtype_id,
				raceId: player?.race_id,
				rating: player?.newrating,
				matchId,
				at
			});
			const alias = typeof player?.alias === 'string' ? player.alias.trim() : '';

			if (!isValidSteamId(steamId) || !slot || !alias) {
				continue;
			}

			if (!bySteam[steamId]) {
				bySteam[steamId] = {
					steamId,
					profileId: player?.profile_id,
					alias,
					slots: [slot]
				};
				continue;
			}

			bySteam[steamId].profileId = player?.profile_id;
			bySteam[steamId].alias = alias;
			upsertSnapshotSlot(bySteam[steamId].slots, slot);
		}
	}

	return ingestPlayerList(Object.values(bySteam));
}

function ingestLobbyRecord(e) {
	try {
		if (e.record.get('title') === 'Skirmish') {
			return;
		}

		const result = e.record.get('result');
		if (!result) {
			return;
		}

		ingestLobbyResult(result);
	} catch (error) {
		console.log('[player_ratings] lobby hook failed', e.record?.id, String(error));
	}
}

function handleGetBySteamId(e) {
	const steamId = e.request.pathValue('steamId');
	if (
		!isValidSteamId(steamId) ||
		steamId === 'backfill' ||
		steamId === 'harvest' ||
		steamId === 'fill-from-lobbies'
	) {
		return e.json(400, { message: 'steamId is required' });
	}

	const forceFill = e.request.url.query().get('fill') === '1';
	let record = findBySteamId(steamId);

	if (forceFill) {
		try {
			fillFromLobbies(steamId, record?.get('profileId'));
			record = findBySteamId(steamId);
		} catch (error) {
			console.log('[player_ratings] lobby fill on get failed', steamId, String(error));
		}
	}

	if (!record) {
		return e.json(404, { message: 'Not found' });
	}

	return e.json(200, serializeRecord(record));
}

function handleFillFromLobbies(e) {
	if (!e.hasSuperuserAuth() && !isServiceRequest(e)) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const steamId = e.request.url.query().get('steamId');
	if (steamId && isValidSteamId(steamId)) {
		return e.json(200, fillFromLobbies(steamId));
	}

	return e.json(200, runLobbyFillBatch());
}

function loadLobbyResultsForHistory(profileId, steamId) {
	if (isValidSteamId(steamId) && hasLobbyIndexSteamId()) {
		const bySteam = queryLobbyResultsBySteamId(steamId, ELO_HISTORY_LIMIT);
		if (bySteam.length > 0) {
			return bySteam;
		}
	}

	const id = Number(profileId);
	if (Number.isInteger(id) && id > 0) {
		return queryLobbyResultsByProfileId(id, ELO_HISTORY_LIMIT);
	}

	return [];
}

function extractEloHistoryPoints(results, profileId, steamId) {
	const profile = Number(profileId);
	const hasProfile = Number.isInteger(profile) && profile > 0;
	const hasSteam = isValidSteamId(steamId);
	const byKey = {};
	const earliestOld = {};

	for (const raw of results) {
		const match = parseJson(raw, null);
		if (!match || !isStoredMatchType(match.matchtype_id)) {
			continue;
		}

		const at = Number(match.completiontime ?? match.startgametime ?? 0);
		const matchId = Number(match.id);
		if (!Number.isFinite(at) || at < 0 || !Number.isFinite(matchId) || matchId <= 0) {
			continue;
		}

		for (const player of asList(match.players)) {
			const playerSteam =
				player?.steamId ||
				(typeof player?.name === 'string' ? player.name.replace('/steam/', '') : '');
			const playerProfile = Number(player?.profile_id);
			const matchesProfile = hasProfile && playerProfile === profile;
			const matchesSteam = hasSteam && playerSteam === steamId;

			if (!matchesProfile && !matchesSteam) {
				continue;
			}

			const raceId = Number(player?.race_id);
			if (!Number.isInteger(raceId) || raceId < 0 || raceId > 3) {
				continue;
			}

			const rating = Number(player?.newrating);
			if (!Number.isFinite(rating) || rating < 1) {
				continue;
			}

			const key = `${matchId}:${raceId}`;
			const point = {
				at,
				rating,
				matchtypeId: Number(match.matchtype_id),
				raceId,
				matchId
			};

			const existing = byKey[key];
			if (!existing || at >= existing.at) {
				byKey[key] = point;
			}

			const oldrating = Number(player?.oldrating);
			if (Number.isFinite(oldrating) && oldrating >= 1) {
				const seriesKey = `${point.matchtypeId}:${raceId}`;
				const current = earliestOld[seriesKey];
				if (!current || at <= current.at) {
					earliestOld[seriesKey] = { at, rating: oldrating, matchtypeId: point.matchtypeId, raceId, matchId };
				}
			}
		}
	}

	const points = Object.values(byKey);
	const seenSeries = {};

	for (const point of points) {
		const seriesKey = `${point.matchtypeId}:${point.raceId}`;
		seenSeries[seriesKey] = true;
	}

	for (const [seriesKey, seed] of Object.entries(earliestOld)) {
		if (!seenSeries[seriesKey]) {
			continue;
		}

		const hasEarlierOrEqual = points.some(
			(point) =>
				point.matchtypeId === seed.matchtypeId &&
				point.raceId === seed.raceId &&
				point.at <= seed.at &&
				point.rating === seed.rating
		);

		if (!hasEarlierOrEqual) {
			points.push({
				at: Math.max(0, seed.at - 1),
				rating: seed.rating,
				matchtypeId: seed.matchtypeId,
				raceId: seed.raceId,
				matchId: seed.matchId
			});
		}
	}

	points.sort((a, b) => a.at - b.at || a.matchId - b.matchId || a.raceId - b.raceId);
	return points;
}

function handleEloHistory(e) {
	const query = e.request.url.query();
	const profileIdRaw = query.get('profileId') || '';
	const steamId = String(query.get('steamId') || '').trim();
	const profileId = Number(profileIdRaw);

	if ((!Number.isInteger(profileId) || profileId <= 0) && !isValidSteamId(steamId)) {
		return e.json(400, { message: 'profileId or steamId is required' });
	}

	try {
		const results = loadLobbyResultsForHistory(
			Number.isInteger(profileId) && profileId > 0 ? profileId : null,
			steamId
		);
		const points = extractEloHistoryPoints(results, profileId, steamId);
		return e.json(200, { points });
	} catch (error) {
		console.log('[player_ratings] elo history failed', String(error));
		return e.json(500, { message: 'Failed to load elo history' });
	}
}

function handleIngest(e) {
	if (!e.auth?.id && !e.hasSuperuserAuth() && !isServiceRequest(e)) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const body = readRequestJsonBody(e);
	const players = asList(body?.players);

	if (players.length === 0) {
		return e.json(400, { message: 'players is required' });
	}

	if (players.length > MAX_INGEST_PLAYERS) {
		return e.json(400, { message: `players cannot exceed ${MAX_INGEST_PLAYERS}` });
	}

	const records = [];

	for (const player of players) {
		const steamId = String(player?.steamId || player?.steam_id || '');
		const slots = asList(player?.slots).map(normalizeSlot).filter(Boolean);

		try {
			const record = upsertPlayerRating({
				steamId,
				profileId: player?.profileId ?? player?.profile_id,
				alias: player?.alias,
				slots
			});

			if (record) {
				records.push(serializeRecord(record));
			}
		} catch (error) {
			console.log('[player_ratings] ingest failed', steamId, String(error));
		}
	}

	return e.json(200, { players: records });
}

module.exports = {
	COLLECTION,
	MAX_ELO_SLOTS,
	LOBBY_FILL_BATCH_SIZE,
	isServiceRequest,
	isStoredMatchType,
	isValidSteamId,
	parseJson,
	asList,
	readRequestJsonBody,
	countEloSlots,
	eloHasGaps,
	getStoredEloForLeaderboard,
	findBySteamId,
	readEloFromRecord,
	findByProfileId,
	fillFromLobbies,
	runLobbyFillBatch,
	ingestLobbyRecord,
	ingestLobbyResult,
	ingestTransformedMatches,
	handleGetBySteamId,
	handleFillFromLobbies,
	handleIngest,
	handleEloHistory,
	serializeRecord
};
