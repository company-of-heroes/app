// Public member-uploaded replays (GameReplays-style catalog).
'use strict';

const { clientIp, limitCountRequest, TOO_MANY } = require(`${__hooks}/lib/download-rate-limit.js`);
const {
	isValidSteamId,
	getStoredEloForLeaderboard,
	findBySteamId,
	readEloFromRecord
} = require(`${__hooks}/lib/player-ratings.js`);
const { fetchRelicProfileBySteamId } = require(`${__hooks}/lib/player.js`);

const HTTP_CACHE_CONTROL = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300';
const PER_PAGE_DEFAULT = 30;
const PER_PAGE_MAX = 50;
const MAX_FILE_BYTES = 52_428_800;

const ALLOWED_ORIGINS = [
	'https://coh1stats.com',
	'https://www.coh1stats.com',
	'http://localhost:5174',
	'http://127.0.0.1:5174'
];

function applyCors(e) {
	const origin = e.request.header.get('Origin');
	if (origin && ALLOWED_ORIGINS.includes(origin)) {
		e.response.header().set('Access-Control-Allow-Origin', origin);
		e.response.header().set('Vary', 'Origin, Authorization');
	} else {
		e.response.header().set('Vary', 'Authorization');
	}
	e.response.header().set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
	e.response.header().set(
		'Access-Control-Allow-Headers',
		'Content-Type, X-Download-Visitor, Authorization'
	);
}

function isStaffAuth(auth) {
	if (!auth) {
		return false;
	}

	const role = auth.get('role');
	return role === 'admin' || role === 'moderator';
}

function ownerIdFromRecord(record) {
	const userRef = record.get('createdBy');
	if (!userRef) {
		return '';
	}

	if (typeof userRef === 'object' && userRef.id) {
		return String(userRef.id);
	}

	return String(userRef);
}

function isOwnerAuth(auth, record) {
	if (!auth || !auth.id) {
		return false;
	}

	return ownerIdFromRecord(record) === String(auth.id);
}

function jsonWithCors(e, status, body) {
	applyCors(e);
	if (status === 200) {
		e.response.header().set('Cache-Control', HTTP_CACHE_CONTROL);
	} else {
		e.response.header().set('Cache-Control', 'no-store');
	}
	return e.json(status, body);
}

function jsonNoStore(e, status, body) {
	applyCors(e);
	e.response.header().set('Cache-Control', 'no-store');
	return e.json(status, body);
}

function handleOptions(e) {
	applyCors(e);
	return e.noContent(204);
}

function raceFromFaction(faction) {
	const value = String(faction || '').toLowerCase();
	if (value.includes('commonwealth')) return 2;
	if (value.includes('panzer')) return 3;
	if (value.startsWith('axis')) return 1;
	return 0;
}

function parsePlayersJson(raw) {
	if (raw == null || raw === '') {
		return [];
	}

	try {
		let value = raw;

		if (typeof value === 'string') {
			value = JSON.parse(value);
		} else if (Array.isArray(value)) {
			// Goja sometimes exposes JSON text as char codes or single-char strings.
			if (
				value.length > 8 &&
				value.every((item) => typeof item === 'number' && item >= 0 && item <= 0xffff)
			) {
				value = JSON.parse(String.fromCharCode.apply(null, value));
			} else if (
				value.length > 8 &&
				value.every((item) => typeof item === 'string' && item.length === 1)
			) {
				value = JSON.parse(value.join(''));
			} else {
				// Normalize Goja map values to plain objects
				value = JSON.parse(JSON.stringify(value));
			}
		} else {
			value = JSON.parse(JSON.stringify(value));
		}

		if (typeof value === 'string') {
			value = JSON.parse(value);
		}

		if (!Array.isArray(value)) {
			return [];
		}

		return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
	} catch (error) {
		console.warn('[member-replays] parsePlayersJson', String(error?.message || error));
		return [];
	}
}

/** Relic often stores mapName as `$12345`; prefer the scenario path basename. */
function displayMapName(mapName, mapFilename) {
	const name = String(mapName || '').trim();
	const file = String(mapFilename || '').trim();
	const fromFile = file ? file.split(/[/\\]/).pop() || file : '';
	if (/^\$\d+$/.test(name) && fromFile) {
		return fromFile;
	}

	return name || fromFile || 'Unknown';
}

function bodyJsonArray(body, key) {
	if (!body || typeof body !== 'object') {
		return [];
	}

	const value = body[key];
	if (value == null || value === '') {
		return [];
	}

	if (Array.isArray(value)) {
		return value;
	}

	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	return [];
}

function byteSize(bytes) {
	if (bytes == null) {
		return 0;
	}

	if (typeof bytes === 'string') {
		return bytes.length;
	}

	const length = Number(bytes.length);
	if (Number.isFinite(length) && length >= 0) {
		return length;
	}

	const byteLength = Number(bytes.byteLength);
	if (Number.isFinite(byteLength) && byteLength >= 0) {
		return byteLength;
	}

	return 0;
}

/** Read multipart file bytes before requestInfo().body consumes the form. */
function readUploadedReplayBytes(e) {
	let files;
	try {
		files = e.findUploadedFiles('file');
	} catch (error) {
		console.warn('[member-replays] findUploadedFiles', String(error?.message || error));
		throw new Error('Replay file is required.');
	}

	if (!files || !files.length) {
		throw new Error('Replay file is required.');
	}

	const uploaded = files[0];
	const fallbackName = String(uploaded.name || 'replay.rec').trim() || 'replay.rec';
	const tempPath = `${$os.tempDir()}/member-replay-${Date.now()}-${String(Math.random()).slice(2, 10)}.rec`;

	// findUploadedFiles values cannot be passed straight to record.set in this
	// JSVM — Goja turns them into plain objects and the file is saved as
	// "[object Object]". Write bytes to a temp path (same pattern as overlays)
	// and rebuild via fileFromPath.
	const reader = uploaded.reader.open();
	let bytes;
	try {
		bytes = toBytes(reader);
		const size = byteSize(bytes);
		console.warn('[member-replays] upload bytes', fallbackName, 'size', size, 'typeof', typeof bytes);

		if (!size || size < 64) {
			throw new Error('Replay file is empty or corrupt.');
		}

		if (size > MAX_FILE_BYTES) {
			throw new Error('Replay file is too large.');
		}

		if (typeof bytes === 'string' && bytes.indexOf('[object Object]') === 0) {
			throw new Error('Replay file is empty or corrupt.');
		}

		$os.writeFile(tempPath, bytes, 0o644);
	} finally {
		reader.close();
	}

	const written = byteSize($os.readFile(tempPath));
	if (written < 64) {
		try {
			$os.remove(tempPath);
		} catch {
			// ignore
		}
		throw new Error('Replay file is empty or corrupt.');
	}

	return { tempPath, fallbackName, size: written };
}

function toCommunityPlayers(rawPlayers) {
	const players = parsePlayersJson(rawPlayers);
	const out = [];
	for (let i = 0; i < players.length; i++) {
		const player = players[i] || {};
		const alias = String(player.name || player.alias || '').trim() || `Player ${i + 1}`;
		const steamId = normalizeSteamId(player.steamId);
		const faction = String(player.faction || '').trim();
		const doctrineName = String(player.doctrineName || '').trim();
		const localId = Number(player.id);
		let profileId =
			Number.isFinite(localId) && localId > 0 && localId < 1000 ? localId : i + 1;

		if (steamId) {
			try {
				const record = findBySteamId(steamId);
				if (record) {
					const fromRecord = Number(record.get('profileId'));
					if (Number.isFinite(fromRecord) && fromRecord > 0) {
						profileId = fromRecord;
					}
				}
			} catch {
				// keep fallback profile id
			}
		}

		out.push({
			playerId: profileId,
			steamId,
			race: raceFromFaction(faction),
			faction: faction || undefined,
			doctrineName: doctrineName || undefined,
			profile: {
				profile_id: profileId,
				alias
			}
		});
	}
	return out;
}

function normalizeSteamId(value) {
	if (value == null || value === '') {
		return null;
	}

	const raw = String(value).trim();
	const fromPath = raw.match(/\/steam\/(\d+)/i);
	const candidate = fromPath ? fromPath[1] : raw.replace(/^[^\d]*/, '').replace(/[^\d].*$/, '');
	if (isValidSteamId(candidate)) {
		return candidate;
	}

	if (isValidSteamId(raw)) {
		return raw;
	}

	return null;
}

function matchTypeIdFromPlayerCount(count, isRanked) {
	if (!isRanked) {
		return 0;
	}

	const n = Number(count) || 0;
	if (n <= 2) {
		return 1;
	}
	if (n <= 4) {
		return 2;
	}
	if (n <= 6) {
		return 3;
	}

	return 4;
}

function leaderboardIdForMatchRace(matchTypeId, race) {
	const type = Number(matchTypeId);
	const raceId = Number(race);
	if (!Number.isInteger(type) || type < 0 || type > 7) {
		return null;
	}
	if (!Number.isInteger(raceId) || raceId < 0 || raceId > 3) {
		return null;
	}

	return type * 4 + raceId;
}

function parseStatsSnapshot(raw) {
	if (raw == null || raw === '') {
		return null;
	}

	try {
		let value = raw;
		if (typeof value === 'string') {
			value = JSON.parse(value);
		} else if (Array.isArray(value)) {
			if (
				value.length > 8 &&
				value.every((item) => typeof item === 'number' && item >= 0 && item <= 0xffff)
			) {
				value = JSON.parse(String.fromCharCode.apply(null, value));
			} else if (
				value.length > 8 &&
				value.every((item) => typeof item === 'string' && item.length === 1)
			) {
				value = JSON.parse(value.join(''));
			} else {
				value = JSON.parse(JSON.stringify(value));
			}
		} else {
			value = JSON.parse(JSON.stringify(value));
		}

		if (typeof value === 'string') {
			value = JSON.parse(value);
		}

		return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
	} catch (error) {
		console.warn('[member-replays] parseStatsSnapshot', String(error?.message || error));
		return null;
	}
}

/** Build Relic-shaped result.players from player_ratings + Relic personal stats (frozen at upload). */
function pickLeaderboardStat(leaderboardStats, leaderboardId) {
	if (!Array.isArray(leaderboardStats) || leaderboardId == null) {
		return null;
	}

	for (let i = 0; i < leaderboardStats.length; i++) {
		if (Number(leaderboardStats[i].leaderboard_id) === Number(leaderboardId)) {
			return leaderboardStats[i];
		}
	}

	return null;
}

function fetchRelicProfileCached(steamId, cache) {
	if (Object.prototype.hasOwnProperty.call(cache, steamId)) {
		return cache[steamId];
	}

	try {
		cache[steamId] = fetchRelicProfileBySteamId(steamId);
	} catch (error) {
		console.warn('[member-replays] relic personalstat', steamId, String(error?.message || error));
		cache[steamId] = null;
	}

	return cache[steamId];
}

function buildStatsSnapshot(playersRaw, options) {
	const players = parsePlayersJson(playersRaw);
	const isRanked = !!(options && options.isRanked);
	const duration = Number(options && options.durationInSeconds) || 0;
	const matchTypeId = matchTypeIdFromPlayerCount(players.length, isRanked);
	const resultPlayers = [];
	const relicCache = {};

	for (let i = 0; i < players.length; i++) {
		const player = players[i] || {};
		const alias = String(player.name || player.alias || '').trim() || `Player ${i + 1}`;
		const steamId = normalizeSteamId(player.steamId);
		const race = raceFromFaction(player.faction);
		// Replay-local ids (often 1000+) are not Relic profile ids — only keep as last resort.
		const localId = Number(player.id);
		let profileId =
			Number.isFinite(localId) && localId > 0 && localId < 1000 ? localId : i + 1;
		let rating = null;
		let country = null;
		let wins = 0;
		let losses = 0;
		let streak = 0;
		let rank = 0;
		let rankLevel = 0;

		if (steamId) {
			try {
				const record = findBySteamId(steamId);
				if (record) {
					const fromRecord = Number(record.get('profileId'));
					if (Number.isFinite(fromRecord) && fromRecord > 0) {
						profileId = fromRecord;
					}
					const leaderboardId = leaderboardIdForMatchRace(matchTypeId, race);
					if (leaderboardId != null) {
						// record.get('elo') is unreliable in Goja — use SQL-backed map.
						rating = getStoredEloForLeaderboard(readEloFromRecord(record), leaderboardId);
					}
				}
			} catch (error) {
				console.warn('[member-replays] stats snapshot elo', steamId, String(error?.message || error));
			}

			const relic = fetchRelicProfileCached(steamId, relicCache);
			if (relic) {
				const fromRelic = Number(relic.profile_id);
				if (Number.isFinite(fromRelic) && fromRelic > 0) {
					profileId = fromRelic;
				}
				const relicCountry = String(relic.country || '').trim();
				if (relicCountry) {
					country = relicCountry;
				}

				const leaderboardId = leaderboardIdForMatchRace(matchTypeId, race);
				const stat = pickLeaderboardStat(relic.leaderboardStats, leaderboardId);
				if (stat) {
					wins = Number(stat.wins) || 0;
					losses = Number(stat.losses) || 0;
					streak = Number(stat.streak) || 0;
					const rawRank = Number(stat.rank);
					rank = Number.isFinite(rawRank) && rawRank > 0 ? rawRank : 0;
					const rawRankLevel = Number(stat.ranklevel);
					rankLevel =
						Number.isFinite(rawRankLevel) && rawRankLevel > 0 ? rawRankLevel : 0;
					if (rating == null || rating < 1) {
						const relicRating = Number(stat.rating);
						if (Number.isFinite(relicRating) && relicRating >= 1) {
							rating = relicRating;
						}
					}
				}
			}
		}

		const entry = {
			profile_id: profileId,
			alias,
			race_id: race,
			oldrating: rating != null && rating >= 1 ? rating : 0,
			newrating: rating != null && rating >= 1 ? rating : 0,
			wins,
			losses,
			streak,
			rank,
			rankLevel
		};
		if (steamId) {
			entry.steamId = steamId;
		}
		if (country) {
			entry.country = country;
		}
		resultPlayers.push(entry);
	}

	return {
		matchtype_id: matchTypeId,
		startgametime: 0,
		completiontime: duration > 0 ? duration : 0,
		players: resultPlayers,
		snappedAt: new Date().toISOString()
	};
}

function snapshotPlayerHasLadderStats(player) {
	if (!player || typeof player !== 'object') {
		return false;
	}

	if (String(player.country || '').trim()) {
		return true;
	}

	const wins = Number(player.wins) || 0;
	const losses = Number(player.losses) || 0;
	const rank = Number(player.rank) || 0;
	const rankLevel = Number(player.rankLevel) || 0;
	return wins > 0 || losses > 0 || rank > 0 || rankLevel > 0;
}

function snapshotNeedsRatingRepair(snapshot, playersRaw) {
	const players = parsePlayersJson(playersRaw);
	const hasSteam = players.some((player) => normalizeSteamId(player && player.steamId));
	if (!hasSteam) {
		return false;
	}

	const resultPlayers =
		snapshot && Array.isArray(snapshot.players) ? snapshot.players : [];
	if (!resultPlayers.length) {
		return true;
	}

	const allRatingsZero = resultPlayers.every((player) => {
		const oldRating = Number(player && player.oldrating) || 0;
		const newRating = Number(player && player.newrating) || 0;
		return oldRating < 1 && newRating < 1;
	});
	if (allRatingsZero) {
		return true;
	}

	// Steam IDs present but ladder chrome (country / W-L / rank) never snapped.
	return !resultPlayers.some((player) => snapshotPlayerHasLadderStats(player));
}

function resolveStatsSnapshot(record) {
	const snapshot = parseStatsSnapshot(record.get('statsSnapshot'));
	if (!snapshotNeedsRatingRepair(snapshot, record.get('players'))) {
		return snapshot;
	}

	const repaired = buildStatsSnapshot(record.get('players'), {
		isRanked: !!record.get('isRanked'),
		durationInSeconds: Number(record.get('durationInSeconds')) || 0
	});

	try {
		record.set('statsSnapshot', repaired);
		$app.save(record);
	} catch (error) {
		console.warn('[member-replays] stats snapshot repair', String(error?.message || error));
	}

	return repaired;
}

function findSnapshotPlayer(resultPlayers, communityPlayer, index) {
	// Snapshot and roster are built in the same player order — prefer index so
	// duplicate steam IDs (test fixtures / shared accounts) stay distinct.
	if (index >= 0 && index < resultPlayers.length) {
		return resultPlayers[index];
	}

	const steamId = communityPlayer && communityPlayer.steamId ? String(communityPlayer.steamId) : '';
	if (steamId) {
		for (let i = 0; i < resultPlayers.length; i++) {
			if (String(resultPlayers[i].steamId || '') === steamId) {
				return resultPlayers[i];
			}
		}
	}

	const alias = String(
		(communityPlayer && communityPlayer.profile && communityPlayer.profile.alias) || ''
	)
		.trim()
		.toLowerCase();
	if (alias) {
		for (let i = 0; i < resultPlayers.length; i++) {
			if (String(resultPlayers[i].alias || '').trim().toLowerCase() === alias) {
				return resultPlayers[i];
			}
		}
	}

	return null;
}

function livePlayersFromSnapshot(snapshot, communityPlayers) {
	const resultPlayers =
		snapshot && Array.isArray(snapshot.players) ? snapshot.players : [];
	const out = [];

	for (let i = 0; i < communityPlayers.length; i++) {
		const community = communityPlayers[i] || {};
		const snap = findSnapshotPlayer(resultPlayers, community, i) || {};
		const profileId =
			Number(community.profile && community.profile.profile_id) ||
			Number(snap.profile_id) ||
			i + 1;
		const alias =
			String((community.profile && community.profile.alias) || snap.alias || '').trim() ||
			`Player ${i + 1}`;
		const race =
			community.race != null && Number.isFinite(Number(community.race))
				? Number(community.race)
				: Number(snap.race_id) || 0;
		const steamId = community.steamId || snap.steamId || null;
		const elo =
			Number(snap.newrating) >= 1
				? Number(snap.newrating)
				: Number(snap.oldrating) >= 1
					? Number(snap.oldrating)
					: null;
		const wins = Number(snap.wins) || 0;
		const losses = Number(snap.losses) || 0;
		const streak = Number(snap.streak) || 0;
		const rawRank = Number(snap.rank);
		const rank = Number.isFinite(rawRank) && rawRank > 0 ? rawRank : 0;
		const rawRankLevel = Number(snap.rankLevel);
		const rankLevel =
			Number.isFinite(rawRankLevel) && rawRankLevel > 0 ? rawRankLevel : 0;
		const country = String(snap.country || '').trim() || null;
		const hasStats = elo != null || wins > 0 || losses > 0 || rank > 0 || rankLevel > 0;

		out.push({
			index: i,
			playerId: profileId,
			race,
			alias,
			profileId,
			steamId,
			country,
			stats: hasStats
				? {
						elo,
						wins,
						losses,
						streak,
						rank,
						rankLevel
					}
				: null
		});
	}

	return out;
}

function resultPlayersForSerialize(resultPlayers) {
	const out = [];
	for (let i = 0; i < resultPlayers.length; i++) {
		const player = resultPlayers[i] || {};
		const entry = {
			profile_id: Number(player.profile_id) || i + 1,
			alias: player.alias,
			race_id: player.race_id,
			oldrating: Number(player.oldrating) || 0,
			newrating: Number(player.newrating) || 0,
			wins: Number(player.wins) || 0,
			losses: Number(player.losses) || 0,
			streak: Number(player.streak) || 0
		};
		if (player.steamId) {
			entry.steamId = player.steamId;
		}
		if (player.country) {
			entry.country = player.country;
		}
		out.push(entry);
	}
	return out;
}

function ownerFromRecord(record) {
	const userRef = record.get('createdBy');
	const userId = userRef && typeof userRef === 'object' ? userRef.id : userRef;
	if (!userId) {
		return null;
	}

	let user;
	try {
		user = $app.findRecordById('users', String(userId));
	} catch {
		return null;
	}

	const name = String(user.get('name') || '').trim();
	if (name) {
		return { id: String(user.id), alias: name };
	}

	const email = String(user.get('email') || '').trim();
	if (email) {
		return { id: String(user.id), alias: email.split('@')[0] || email };
	}

	return { id: String(user.id), alias: String(user.id) };
}

function serializeMemberReplay(record, options) {
	const detail = !!(options && options.detail);
	const duration = Number(record.get('durationInSeconds')) || 0;
	const players = toCommunityPlayers(record.get('players'));
	// Relic personalstat repair can be slow — only on detail GET, not list.
	const snapshot = detail
		? resolveStatsSnapshot(record)
		: parseStatsSnapshot(record.get('statsSnapshot'));
	const rawResultPlayers =
		snapshot && Array.isArray(snapshot.players) ? snapshot.players : [];
	const resultPlayers = resultPlayersForSerialize(rawResultPlayers);
	const livePlayers = livePlayersFromSnapshot(snapshot, players);
	const mapFilename = record.get('mapFilename') || '';
	const mapName = displayMapName(record.get('mapName'), mapFilename);
	const body = {
		id: record.id,
		kind: 'member',
		map: mapName,
		title: record.get('title') || '',
		description: record.get('description') || '',
		isRanked: !!record.get('isRanked'),
		createdAt: record.get('createdAt') || record.get('created') || '',
		durationSeconds: duration > 0 ? duration : null,
		likeCount: Number(record.get('likeCount')) || 0,
		downloadCount: Number(record.get('downloadCount')) || 0,
		commentCount: Number(record.get('commentCount')) || 0,
		hasReplay: true,
		replay: record.get('file') || '',
		players,
		livePlayers,
		result:
			duration > 0 || resultPlayers.length > 0
				? {
						matchtype_id:
							snapshot && snapshot.matchtype_id != null
								? Number(snapshot.matchtype_id)
								: undefined,
						startgametime: 0,
						completiontime:
							duration > 0
								? duration
								: Number(snapshot && snapshot.completiontime) || 0,
						players: resultPlayers
					}
				: null,
		uploadedBy: ownerFromRecord(record),
		visibility: String(record.get('visibility') || 'member')
	};

	if (detail) {
		body.mapFilename = mapFilename;
		body.filename = record.get('filename') || '';
		body.isVpGame = !!record.get('isVpGame');
		body.isHighResources = !!record.get('isHighResources');
		body.isRandomStart = !!record.get('isRandomStart');
		body.vpCount = Number(record.get('vpCount')) || 0;
		body.gameDate = record.get('gameDate') || '';
		body.messages = parsePlayersJson(record.get('messages'));
		body.roster = parsePlayersJson(record.get('players'));
	}

	return body;
}

function loadMemberReplay(id, options) {
	const includeDeleted = !!(options && options.includeDeleted);
	let record;
	try {
		record = $app.findRecordById('replays', id);
	} catch {
		const error = new Error('Replay not found');
		error.status = 404;
		throw error;
	}

	const visibility = String(record.get('visibility') || '');
	if (visibility === 'member') {
		// ok
	} else if (visibility === 'deleted' && includeDeleted) {
		// staff
	} else {
		const error = new Error('Replay not found');
		error.status = 404;
		throw error;
	}

	if (!record.get('file')) {
		const error = new Error('Replay not found');
		error.status = 404;
		throw error;
	}

	return record;
}

function parseBool(value) {
	if (value === true || value === 1) return true;
	const raw = String(value || '')
		.trim()
		.toLowerCase();
	return raw === '1' || raw === 'true' || raw === 'yes';
}

function parseListQuery(e) {
	const q = e.request.url.query();
	const page = Math.max(1, Number(q.get('page')) || 1);
	let perPage = Number(q.get('perPage')) || PER_PAGE_DEFAULT;
	if (!Number.isFinite(perPage) || perPage < 1) perPage = PER_PAGE_DEFAULT;
	perPage = Math.min(PER_PAGE_MAX, Math.floor(perPage));

	const ranked = parseBool(q.get('ranked'));
	const title = String(q.get('title') || '').trim();
	const mapsRaw = String(q.get('maps') || '').trim();
	const maps = mapsRaw
		? mapsRaw
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean)
		: [];

	const sortRaw = String(q.get('sort') || 'createdAt').trim();
	const sortDir = String(q.get('sortDir') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
	const sortColumn =
		sortRaw === 'downloadCount'
			? 'downloadCount'
			: sortRaw === 'likeCount'
				? 'likeCount'
				: sortRaw === 'commentCount'
					? 'commentCount'
					: 'createdAt';

	return { page, perPage, ranked, title, maps, sortColumn, sortDir };
}

function handleList(e) {
	try {
		const query = parseListQuery(e);
		const staff = isStaffAuth(e.auth);
		const filters = [];
		const params = {};

		if (staff) {
			filters.push('(visibility = {:visibilityMember} || visibility = {:visibilityDeleted})');
			params.visibilityMember = 'member';
			params.visibilityDeleted = 'deleted';
		} else {
			filters.push('visibility = {:visibility}');
			params.visibility = 'member';
		}

		if (query.ranked) {
			filters.push('isRanked = true');
		}

		if (query.title) {
			filters.push('title ~ {:title}');
			params.title = query.title;
		}

		if (query.maps.length === 1) {
			filters.push('mapName = {:map0}');
			params.map0 = query.maps[0];
		} else if (query.maps.length > 1) {
			const parts = [];
			for (let i = 0; i < query.maps.length; i++) {
				const key = `map${i}`;
				parts.push(`mapName = {:${key}}`);
				params[key] = query.maps[i];
			}
			filters.push(`(${parts.join(' || ')})`);
		}

		const filter = filters.join(' && ');
		const sort = `${query.sortDir === 'ASC' ? '+' : '-'}${query.sortColumn}`;

		const offset = (query.page - 1) * query.perPage;
		const result = $app.findRecordsByFilter(
			'replays',
			filter,
			sort,
			query.perPage,
			offset,
			params
		);

		let totalItems = 0;
		try {
			const countRows = arrayOf(new DynamicModel({ total: 0 }));
			let countSql = staff
				? `SELECT COUNT(*) AS total FROM replays WHERE (visibility = 'member' OR visibility = 'deleted')`
				: `SELECT COUNT(*) AS total FROM replays WHERE visibility = 'member'`;
			const binds = {};
			if (query.ranked) {
				countSql += ' AND isRanked = 1';
			}
			if (query.title) {
				countSql += ' AND title LIKE {:titleLike}';
				binds.titleLike = `%${query.title}%`;
			}
			if (query.maps.length === 1) {
				countSql += ' AND mapName = {:map0}';
				binds.map0 = query.maps[0];
			} else if (query.maps.length > 1) {
				const mapParts = [];
				for (let i = 0; i < query.maps.length; i++) {
					const key = `map${i}`;
					mapParts.push(`mapName = {:${key}}`);
					binds[key] = query.maps[i];
				}
				countSql += ` AND (${mapParts.join(' OR ')})`;
			}
			$app.db().newQuery(countSql).bind(binds).all(countRows);
			totalItems = Number(countRows[0]?.total) || 0;
		} catch {
			totalItems = result.length + offset;
		}

		const totalPages =
			totalItems > 0 ? Math.ceil(totalItems / query.perPage) : query.page > 1 ? query.page : 0;
		const body = {
			page: query.page,
			perPage: query.perPage,
			totalItems,
			totalPages,
			items: result.map((record) => serializeMemberReplay(record, { detail: false }))
		};
		// Staff lists include soft-deleted rows — never cache those responses.
		return staff ? jsonNoStore(e, 200, body) : jsonWithCors(e, 200, body);
	} catch (error) {
		console.warn('[member-replays] list', String(error?.message || error));
		return jsonWithCors(e, 500, { message: 'Failed to load member replays' });
	}
}

function handleGet(e) {
	const id = e.request.pathValue('id');
	if (!id) {
		return jsonWithCors(e, 400, { message: 'id is required' });
	}

	try {
		const record = loadMemberReplay(id, { includeDeleted: isStaffAuth(e.auth) });
		const body = serializeMemberReplay(record, { detail: true });
		if (String(record.get('visibility') || '') === 'deleted') {
			return jsonNoStore(e, 200, body);
		}
		return jsonWithCors(e, 200, body);
	} catch (error) {
		const status = error?.status || 500;
		if (status === 404) {
			return jsonWithCors(e, 404, { message: 'Replay not found' });
		}
		console.warn('[member-replays] get', id, String(error?.message || error));
		return jsonWithCors(e, 500, { message: 'Failed to load replay' });
	}
}

function handleUpdate(e) {
	if (!e.auth || !e.auth.id) {
		return jsonNoStore(e, 401, { message: 'Sign in to edit a member replay.' });
	}

	const id = e.request.pathValue('id');
	if (!id) {
		return jsonNoStore(e, 400, { message: 'id is required' });
	}

	let record;
	try {
		record = loadMemberReplay(id);
	} catch (error) {
		const status = error?.status || 500;
		if (status === 404) {
			return jsonNoStore(e, 404, { message: 'Replay not found' });
		}
		return jsonNoStore(e, 500, { message: 'Failed to load replay' });
	}

	if (!isOwnerAuth(e.auth, record)) {
		return jsonNoStore(e, 403, { message: 'You can only edit your own uploads.' });
	}

	const body = e.requestInfo()?.body || {};
	let playersChanged = false;

	if (Object.prototype.hasOwnProperty.call(body, 'title')) {
		const title = bodyField(body, 'title').trim();
		if (!title) {
			return jsonNoStore(e, 400, { message: 'Title is required.' });
		}
		record.set('title', title.slice(0, 200));
	}

	if (Object.prototype.hasOwnProperty.call(body, 'description')) {
		const description = bodyField(body, 'description').trim();
		if (!description) {
			return jsonNoStore(e, 400, { message: 'Description is required.' });
		}
		record.set('description', description.slice(0, 2000));
	}

	if (Object.prototype.hasOwnProperty.call(body, 'players')) {
		let players = [];
		if (Array.isArray(body.players)) {
			players = body.players;
		} else {
			players = bodyJsonArray(body, 'players');
		}
		record.set('players', players);
		playersChanged = true;
	}

	if (Object.prototype.hasOwnProperty.call(body, 'visibility')) {
		const nextVisibility = bodyField(body, 'visibility').trim();
		if (nextVisibility === 'deleted') {
			record.set('visibility', 'deleted');
		} else if (nextVisibility && nextVisibility !== String(record.get('visibility') || '')) {
			return jsonNoStore(e, 400, { message: 'Invalid replay update.' });
		}
	}

	if (playersChanged) {
		const durationInSeconds = Number(record.get('durationInSeconds')) || 0;
		const isRanked = !!record.get('isRanked');
		record.set(
			'statsSnapshot',
			buildStatsSnapshot(record.get('players'), {
				isRanked,
				durationInSeconds
			})
		);
	}

	try {
		$app.save(record);
		return jsonNoStore(e, 200, serializeMemberReplay(record, { detail: true }));
	} catch (error) {
		console.warn('[member-replays] update', id, String(error?.message || error));
		return jsonNoStore(e, 500, { message: 'Failed to update replay.' });
	}
}

function handleSoftDelete(e) {
	if (!e.auth || !e.auth.id) {
		return jsonNoStore(e, 401, { message: 'Sign in to delete a member replay.' });
	}

	const id = e.request.pathValue('id');
	if (!id) {
		return jsonNoStore(e, 400, { message: 'id is required' });
	}

	let record;
	try {
		record = $app.findRecordById('replays', id);
	} catch {
		return jsonNoStore(e, 404, { message: 'Replay not found' });
	}

	if (!isOwnerAuth(e.auth, record)) {
		return jsonNoStore(e, 403, { message: 'You can only delete your own uploads.' });
	}

	const visibility = String(record.get('visibility') || '');
	if (visibility === 'deleted') {
		return jsonNoStore(e, 200, { id: String(record.id), visibility: 'deleted' });
	}

	if (visibility !== 'member') {
		return jsonNoStore(e, 404, { message: 'Replay not found' });
	}

	try {
		record.set('visibility', 'deleted');
		$app.save(record);
		return jsonNoStore(e, 200, { id: String(record.id), visibility: 'deleted' });
	} catch (error) {
		console.warn('[member-replays] soft delete', id, String(error?.message || error));
		return jsonNoStore(e, 500, { message: 'Failed to delete replay.' });
	}
}

function bodyField(body, key) {
	if (!body || typeof body !== 'object') return '';
	const value = body[key];
	if (value == null) return '';
	return String(value);
}

function handleCreate(e) {
	if (!e.auth || !e.auth.id) {
		return jsonNoStore(e, 401, { message: 'Sign in to upload a member replay.' });
	}

	// Resolve the file BEFORE requestInfo().body — reading the body can consume multipart.
	let uploadTempPath = '';
	let uploadFallbackName = '';
	let uploadSize = 0;
	try {
		const uploaded = readUploadedReplayBytes(e);
		uploadTempPath = uploaded.tempPath;
		uploadFallbackName = uploaded.fallbackName;
		uploadSize = uploaded.size;
	} catch (error) {
		const message = String(error?.message || error);
		console.warn('[member-replays] upload file', message);
		if (message.includes('too large')) {
			return jsonNoStore(e, 400, { message: 'Replay file is too large.' });
		}

		return jsonNoStore(e, 400, { message: 'Replay file is required.' });
	}

	const body = e.requestInfo()?.body || {};
	const filenameHint = bodyField(body, 'filename').trim();
	let filename = filenameHint || uploadFallbackName || 'replay.rec';
	if (!filename.toLowerCase().endsWith('.rec')) {
		try {
			$os.remove(uploadTempPath);
		} catch {
			// ignore
		}
		return jsonNoStore(e, 400, { message: 'Only .rec replay files are supported.' });
	}

	// Ensure the stored filename uses the preferred name (fileFromPath uses path basename).
	const namedTempPath = `${$os.tempDir()}/${filename.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
	try {
		if (namedTempPath !== uploadTempPath) {
			$os.writeFile(namedTempPath, $os.readFile(uploadTempPath), 0o644);
			try {
				$os.remove(uploadTempPath);
			} catch {
				// ignore
			}
			uploadTempPath = namedTempPath;
		}
	} catch (error) {
		console.warn('[member-replays] rename temp', String(error?.message || error));
	}

	const filesystemFile = $filesystem.fileFromPath(uploadTempPath);

	const title = bodyField(body, 'title').trim() || '-';
	const description = bodyField(body, 'description').trim().slice(0, 2000);
	if (!description) {
		return jsonNoStore(e, 400, { message: 'Description is required.' });
	}
	const mapFilenameRaw = bodyField(body, 'mapFilename').trim();
	const mapNameRaw = bodyField(body, 'mapName').trim();
	const mapFilename = mapFilenameRaw || mapNameRaw || 'Unknown';
	const mapName = displayMapName(mapNameRaw, mapFilename);
	const durationInSeconds = Number(bodyField(body, 'durationInSeconds')) || 0;
	const gameDate = bodyField(body, 'gameDate').trim();
	const players = bodyJsonArray(body, 'players');
	const messages = bodyJsonArray(body, 'messages');
	const isRanked = parseBool(bodyField(body, 'isRanked'));
	const isVpGame = parseBool(bodyField(body, 'isVpGame'));
	const isRandomStart = parseBool(bodyField(body, 'isRandomStart'));
	const isHighResources = parseBool(bodyField(body, 'isHighResources'));

	try {
		const collection = $app.findCollectionByNameOrId('replays');
		const record = new Record(collection);
		record.set('createdBy', e.auth.id);
		record.set('visibility', 'member');
		record.set('title', title);
		record.set('description', description);
		record.set('filename', filename);
		record.set('mapName', mapName);
		record.set('mapFilename', mapFilename);
		record.set('durationInSeconds', durationInSeconds);
		record.set('isRanked', isRanked);
		record.set('isVpGame', isVpGame);
		record.set('isRandomStart', isRandomStart);
		record.set('isHighResources', isHighResources);
		record.set('vpCount', Number(bodyField(body, 'vpCount')) || 0);
		if (gameDate) {
			record.set('gameDate', gameDate);
		}
		record.set('players', players);
		record.set('messages', messages);
		record.set('likeCount', 0);
		record.set('downloadCount', 0);
		record.set('commentCount', 0);
		record.set(
			'statsSnapshot',
			buildStatsSnapshot(players, {
				isRanked,
				durationInSeconds
			})
		);
		record.set('file', filesystemFile);
		$app.save(record);

		const savedName = String(record.get('file') || '');
		if (!savedName || savedName === '[object Object]') {
			console.warn('[member-replays] create saved invalid file name', savedName);
			try {
				$app.delete(record);
			} catch {
				// best-effort cleanup
			}
			return jsonNoStore(e, 500, { message: 'Failed to upload replay.' });
		}

		// Verify the persisted blob is real replay bytes, not "[object Object]".
		try {
			const fsys = $app.newFilesystem();
			try {
				const key = `${record.baseFilesPath()}/${savedName}`;
				const stored = fsys.getReader(key);
				try {
					const storedBytes = toBytes(stored);
					const storedSize = byteSize(storedBytes);
					console.warn('[member-replays] stored file', savedName, 'size', storedSize);
					if (storedSize < 64 || storedSize < uploadSize * 0.5) {
						throw new Error(`stored file too small (${storedSize})`);
					}
					if (
						typeof storedBytes === 'string' &&
						storedBytes.indexOf('[object Object]') === 0
					) {
						throw new Error('stored file is [object Object]');
					}
				} finally {
					stored.close();
				}
			} finally {
				fsys.close();
			}
		} catch (error) {
			console.warn('[member-replays] stored file check', String(error?.message || error));
			try {
				$app.delete(record);
			} catch {
				// best-effort cleanup
			}
			return jsonNoStore(e, 500, { message: 'Failed to upload replay.' });
		}

		return jsonNoStore(e, 200, serializeMemberReplay(record, { detail: true }));
	} catch (error) {
		console.warn('[member-replays] create', String(error?.message || error));
		return jsonNoStore(e, 500, { message: 'Failed to upload replay.' });
	} finally {
		try {
			$os.remove(uploadTempPath);
		} catch {
			// ignore
		}
	}
}

function visitorIdFromRequest(e) {
	const header = String(e.request.header.get('X-Download-Visitor') || '').trim();
	if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(header)) {
		return header.toLowerCase();
	}
	return '';
}

function hashFingerprint(kind, value) {
	return String($security.sha256(`${kind}:${value}`) || '').toLowerCase();
}

function fingerprintsForRequest(e) {
	const fingerprints = [];
	const ip = clientIp(e);
	if (ip) fingerprints.push(hashFingerprint('ip', ip));
	const visitorId = visitorIdFromRequest(e);
	if (visitorId) fingerprints.push(hashFingerprint('vid', visitorId));
	return fingerprints;
}

function fingerprintExists(replayId, fingerprint) {
	try {
		$app.findFirstRecordByFilter(
			'member_replay_download_fingerprints',
			'replay = {:replay} && fingerprint = {:fingerprint}',
			{ replay: replayId, fingerprint }
		);
		return true;
	} catch {
		return false;
	}
}

function saveFingerprints(replayId, fingerprints) {
	const collection = $app.findCollectionByNameOrId('member_replay_download_fingerprints');
	let saved = 0;
	let firstId = '';
	for (const fingerprint of fingerprints) {
		try {
			const record = new Record(collection);
			record.set('replay', replayId);
			record.set('fingerprint', fingerprint);
			$app.save(record);
			saved += 1;
			if (!firstId) {
				firstId = record.id;
			}
		} catch {
			// Unique index race
		}
	}
	return { saved, firstId };
}

function handleDownload(e) {
	const limited = limitCountRequest(e);
	if (!limited.ok) {
		e.response.header().set('Retry-After', String(limited.retryAfter || 1));
		return jsonNoStore(e, 429, { message: TOO_MANY, retryAfter: limited.retryAfter || 1 });
	}

	const id = e.request.pathValue('id');
	if (!id) {
		return jsonNoStore(e, 400, { message: 'id is required' });
	}

	let record;
	try {
		record = loadMemberReplay(id, { includeDeleted: isStaffAuth(e.auth) });
	} catch (error) {
		const status = error?.status || 500;
		if (status === 404) {
			return jsonNoStore(e, 404, { message: 'Replay not found' });
		}
		return jsonNoStore(e, 500, { message: 'Failed to record download' });
	}

	try {
		const fingerprints = fingerprintsForRequest(e);
		const count = Number(record.get('downloadCount')) || 0;
		if (!fingerprints.length) {
			return jsonNoStore(e, 200, { downloadCount: count, counted: false });
		}
		if (fingerprints.some((fingerprint) => fingerprintExists(id, fingerprint))) {
			return jsonNoStore(e, 200, { downloadCount: count, counted: false });
		}
		const saved = saveFingerprints(id, fingerprints);
		if (!saved.saved) {
			const fresh = $app.findRecordById('replays', id);
			return jsonNoStore(e, 200, {
				downloadCount: Number(fresh.get('downloadCount')) || 0,
				counted: false
			});
		}
		const next = count + 1;
		record.set('downloadCount', next);
		$app.save(record);
		if (saved.firstId) {
			try {
				require(`${__hooks}/lib/reputation.js`).awardReplayDownload({
					uploaderId: record.get('createdBy'),
					downloaderId: '',
					sourceId: saved.firstId
				});
			} catch (error) {
				console.warn('[member-replays] reputation download', String(error?.message || error));
			}
		}
		return jsonNoStore(e, 200, { downloadCount: next, counted: true });
	} catch (error) {
		console.warn('[member-replays] download', id, String(error?.message || error));
		return jsonNoStore(e, 500, { message: 'Failed to record download' });
	}
}

function handleMaps(e) {
	try {
		const rows = arrayOf(new DynamicModel({ map: '', name: '' }));
		$app
			.db()
			.newQuery(
				`SELECT DISTINCT mapName AS map, mapName AS name
				 FROM replays
				 WHERE visibility = 'member' AND mapName IS NOT NULL AND mapName != ''
				 ORDER BY mapName ASC
				 LIMIT 100`
			)
			.all(rows);

		const items = [];
		for (let i = 0; i < rows.length; i++) {
			const map = String(rows[i].map || '').trim();
			if (!map) continue;
			items.push({ map, name: map });
		}
		return jsonWithCors(e, 200, { items });
	} catch (error) {
		console.warn('[member-replays] maps', String(error?.message || error));
		return jsonWithCors(e, 200, { items: [] });
	}
}

function handlePreviewStats(e) {
	if (!e.auth || !e.auth.id) {
		return jsonNoStore(e, 401, { message: 'Sign in to upload a member replay.' });
	}

	const body = e.requestInfo()?.body || {};
	let players = [];
	if (Array.isArray(body.players)) {
		players = body.players;
	} else {
		players = bodyJsonArray(body, 'players');
	}

	const isRanked = parseBool(body.isRanked ?? bodyField(body, 'isRanked'));
	const durationInSeconds =
		Number(body.durationInSeconds ?? bodyField(body, 'durationInSeconds')) || 0;

	try {
		const snapshot = buildStatsSnapshot(players, { isRanked, durationInSeconds });
		const community = toCommunityPlayers(players);
		return jsonNoStore(e, 200, {
			matchtype_id: snapshot.matchtype_id,
			players: resultPlayersForSerialize(snapshot.players),
			livePlayers: livePlayersFromSnapshot(snapshot, community)
		});
	} catch (error) {
		console.warn('[member-replays] preview stats', String(error?.message || error));
		return jsonNoStore(e, 500, { message: 'Failed to preview replay stats.' });
	}
}

function factionFromRaceId(raceId) {
	const n = Number(raceId);
	if (n === 1) {
		return 'axis';
	}
	if (n === 2) {
		return 'allies_commonwealth';
	}
	if (n === 3) {
		return 'axis_panzerelite';
	}
	return 'allies';
}

function relationId(value) {
	if (!value) {
		return '';
	}
	if (typeof value === 'object' && value.id) {
		return String(value.id);
	}
	return String(value).trim();
}

function playersFromLobbyForMember(lobby, result) {
	const fromLobby = parsePlayersJson(lobby.get('players'));
	if (fromLobby.length > 0) {
		return fromLobby.map((player, index) => {
			const alias =
				String(player.name || player.alias || '').trim() || `Player ${index + 1}`;
			return {
				name: alias,
				alias,
				steamId: normalizeSteamId(player.steamId || player.name),
				faction: String(player.faction || '').trim() || factionFromRaceId(player.race_id),
				doctrineName: String(player.doctrineName || '').trim() || undefined,
				id: Number(player.id || player.profile_id) || index + 1
			};
		});
	}

	const resultPlayers = result && Array.isArray(result.players) ? result.players : [];
	return resultPlayers.map((player, index) => {
		const alias = String(player.alias || player.name || '').trim() || `Player ${index + 1}`;
		return {
			name: alias,
			alias,
			steamId: normalizeSteamId(player.steamId || player.name),
			faction: factionFromRaceId(player.race_id),
			id: Number(player.profile_id) || index + 1
		};
	});
}

function statsSnapshotFromLobby(result, players, isRanked, durationInSeconds) {
	if (result && Array.isArray(result.players) && result.players.length > 0) {
		return {
			matchtype_id:
				Number(result.matchtype_id) ||
				matchTypeIdFromPlayerCount(result.players.length, isRanked),
			startgametime: Number(result.startgametime) || 0,
			completiontime:
				Number(result.completiontime) || (durationInSeconds > 0 ? durationInSeconds : 0),
			players: resultPlayersForSerialize(result.players),
			snappedAt: new Date().toISOString()
		};
	}

	return buildStatsSnapshot(players, { isRanked, durationInSeconds });
}

function copyLobbyReplayToTemp(lobby) {
	const replayName = String(lobby.get('replay') || '').trim();
	if (!replayName) {
		throw new Error('Replay file is required.');
	}

	const tempPath = `${$os.tempDir()}/member-from-match-${Date.now()}-${String(Math.random()).slice(2, 10)}.rec`;
	const fsys = $app.newFilesystem();
	let size = 0;
	try {
		const key = `${lobby.baseFilesPath()}/${replayName}`;
		const reader = fsys.getReader(key);
		try {
			const bytes = toBytes(reader);
			size = byteSize(bytes);
			if (!size || size < 64) {
				throw new Error('Replay file is empty or corrupt.');
			}
			if (size > MAX_FILE_BYTES) {
				throw new Error('Replay file is too large.');
			}
			if (typeof bytes === 'string' && bytes.indexOf('[object Object]') === 0) {
				throw new Error('Replay file is empty or corrupt.');
			}
			$os.writeFile(tempPath, bytes, 0o644);
		} finally {
			reader.close();
		}
	} finally {
		fsys.close();
	}

	const written = byteSize($os.readFile(tempPath));
	if (written < 64) {
		try {
			$os.remove(tempPath);
		} catch {
			// ignore
		}
		throw new Error('Replay file is empty or corrupt.');
	}

	const safeName = replayName.toLowerCase().endsWith('.rec')
		? replayName.replace(/[^a-zA-Z0-9._-]+/g, '_')
		: `${replayName.replace(/[^a-zA-Z0-9._-]+/g, '_')}.rec`;

	return { tempPath, filename: safeName || 'replay.rec', size: written };
}

function handlePublishFromMatch(e) {
	if (!e.auth || !e.auth.id) {
		return jsonNoStore(e, 401, { message: 'Sign in to publish a member replay.' });
	}

	const lobbyId = e.request.pathValue('id');
	if (!lobbyId) {
		return jsonNoStore(e, 400, { message: 'Match id is required.' });
	}

	let lobby;
	try {
		lobby = $app.findRecordById('lobbies', lobbyId);
	} catch {
		return jsonNoStore(e, 404, { message: 'Match not found' });
	}

	const ownerId = relationId(lobby.get('user'));
	if (!ownerId || ownerId !== String(e.auth.id)) {
		return jsonNoStore(e, 403, { message: 'You can only publish your own matches.' });
	}

	const existingMemberReplay = relationId(lobby.get('memberReplay'));
	if (existingMemberReplay) {
		try {
			const existing = $app.findRecordById('replays', existingMemberReplay);
			return jsonNoStore(e, 200, serializeMemberReplay(existing, { detail: true }));
		} catch {
			return jsonNoStore(e, 409, { message: 'This match is already published.' });
		}
	}

	const replayName = String(lobby.get('replay') || '').trim();
	if (!replayName && !lobby.get('hasReplay')) {
		return jsonNoStore(e, 400, { message: 'This match has no replay file.' });
	}

	let uploadTempPath = '';
	let uploadSize = 0;
	let filename = 'replay.rec';
	try {
		const copied = copyLobbyReplayToTemp(lobby);
		uploadTempPath = copied.tempPath;
		uploadSize = copied.size;
		filename = copied.filename;
	} catch (error) {
		const message = String(error?.message || error);
		console.warn('[member-replays] from-match file', message);
		if (message.includes('too large')) {
			return jsonNoStore(e, 400, { message: 'Replay file is too large.' });
		}
		return jsonNoStore(e, 400, { message: 'Replay file is required.' });
	}

	const body = e.requestInfo()?.body || {};
	const mapRaw = String(lobby.get('map') || '').trim();
	const mapFilename = mapRaw || 'Unknown';
	const mapName = displayMapName(mapRaw, mapFilename);
	const titleHint = bodyField(body, 'title').trim();
	const lobbyTitle = String(lobby.get('title') || '').trim();
	const title = titleHint || lobbyTitle || mapName || '-';
	const description = bodyField(body, 'description').trim().slice(0, 2000);
	if (!description) {
		return jsonNoStore(e, 400, { message: 'Description is required.' });
	}
	const isRanked = !!lobby.get('isRanked');
	const result = (() => {
		try {
			return require(`${__hooks}/lib/match-history.js`).parseResultField(lobby.get('result'));
		} catch {
			return null;
		}
	})();
	// PocketBase required number fields treat 0 as blank — never save 0.
	const bodyDuration = Number(body.durationInSeconds ?? bodyField(body, 'durationInSeconds'));
	const storedDuration = Number(lobby.get('durationSeconds'));
	let durationInSeconds = 0;
	if (Number.isFinite(bodyDuration) && bodyDuration > 0) {
		durationInSeconds = Math.floor(bodyDuration);
	} else if (Number.isFinite(storedDuration) && storedDuration > 0) {
		durationInSeconds = Math.floor(storedDuration);
	} else if (result) {
		const start = Number(result.startgametime);
		const end = Number(result.completiontime);
		if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
			durationInSeconds = Math.floor(end - start);
		} else if (Number.isFinite(end) && end > 0) {
			durationInSeconds = Math.floor(end);
		}
	}
	if (!(durationInSeconds > 0)) {
		durationInSeconds = 1;
	}
	const bodyPlayers = bodyJsonArray(body, 'players');
	const players =
		bodyPlayers.length > 0 ? bodyPlayers : playersFromLobbyForMember(lobby, result);
	const statsSnapshot =
		bodyPlayers.length > 0
			? buildStatsSnapshot(players, { isRanked, durationInSeconds })
			: statsSnapshotFromLobby(result, players, isRanked, durationInSeconds);
	const gameDate = String(lobby.get('createdAt') || '').trim();

	const namedTempPath = `${$os.tempDir()}/${filename}`;
	try {
		if (namedTempPath !== uploadTempPath) {
			$os.writeFile(namedTempPath, $os.readFile(uploadTempPath), 0o644);
			try {
				$os.remove(uploadTempPath);
			} catch {
				// ignore
			}
			uploadTempPath = namedTempPath;
		}
	} catch (error) {
		console.warn('[member-replays] from-match rename temp', String(error?.message || error));
	}

	const filesystemFile = $filesystem.fileFromPath(uploadTempPath);

	try {
		const collection = $app.findCollectionByNameOrId('replays');
		const record = new Record(collection);
		record.set('createdBy', e.auth.id);
		record.set('visibility', 'member');
		record.set('title', title);
		record.set('description', description);
		record.set('filename', filename);
		record.set('mapName', mapName);
		record.set('mapFilename', mapFilename);
		record.set('durationInSeconds', durationInSeconds);
		record.set('isRanked', isRanked);
		record.set('isVpGame', false);
		record.set('isRandomStart', false);
		record.set('isHighResources', false);
		record.set('vpCount', 0);
		if (gameDate) {
			record.set('gameDate', gameDate);
		}
		record.set('players', players);
		record.set('messages', []);
		record.set('likeCount', 0);
		record.set('downloadCount', 0);
		record.set('commentCount', 0);
		record.set('statsSnapshot', statsSnapshot);
		record.set('file', filesystemFile);
		$app.save(record);

		const savedName = String(record.get('file') || '');
		if (!savedName || savedName === '[object Object]') {
			console.warn('[member-replays] from-match saved invalid file name', savedName);
			try {
				$app.delete(record);
			} catch {
				// best-effort cleanup
			}
			return jsonNoStore(e, 500, { message: 'Failed to publish replay.' });
		}

		try {
			const fsys = $app.newFilesystem();
			try {
				const key = `${record.baseFilesPath()}/${savedName}`;
				const stored = fsys.getReader(key);
				try {
					const storedBytes = toBytes(stored);
					const storedSize = byteSize(storedBytes);
					if (storedSize < 64 || storedSize < uploadSize * 0.5) {
						throw new Error(`stored file too small (${storedSize})`);
					}
					if (
						typeof storedBytes === 'string' &&
						storedBytes.indexOf('[object Object]') === 0
					) {
						throw new Error('stored file is [object Object]');
					}
				} finally {
					stored.close();
				}
			} finally {
				fsys.close();
			}
		} catch (error) {
			console.warn('[member-replays] from-match stored file check', String(error?.message || error));
			try {
				$app.delete(record);
			} catch {
				// best-effort cleanup
			}
			return jsonNoStore(e, 500, { message: 'Failed to publish replay.' });
		}

		lobby.set('memberReplay', record.id);
		$app.save(lobby);

		try {
			require(`${__hooks}/lib/match-history.js`).invalidateCommunityMatchCount();
		} catch (error) {
			console.warn(
				'[member-replays] invalidate community count',
				String(error?.message || error)
			);
		}

		return jsonNoStore(e, 200, serializeMemberReplay(record, { detail: true }));
	} catch (error) {
		console.warn('[member-replays] from-match', String(error?.message || error));
		return jsonNoStore(e, 500, { message: 'Failed to publish replay.' });
	} finally {
		try {
			$os.remove(uploadTempPath);
		} catch {
			// ignore
		}
	}
}

module.exports = {
	handleOptions,
	handleList,
	handleGet,
	handleCreate,
	handleUpdate,
	handleSoftDelete,
	handleDownload,
	handleMaps,
	handlePreviewStats,
	handlePublishFromMatch,
	loadMemberReplay,
	serializeMemberReplay,
	buildStatsSnapshot
};
