/**
 * Attach a local CoH temp.rec to a durable lobbies row.
 * Any authenticated match participant may upload; byte size wins (strictly larger replaces).
 */
'use strict';

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

	e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS');
	e.response.header().set(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization'
	);
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

function relationId(value) {
	if (!value) {
		return '';
	}

	if (typeof value === 'object') {
		return String(value.id || '');
	}

	return String(value);
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

	const len = Number(bytes.byteLength);
	if (Number.isFinite(len) && len >= 0) {
		return len;
	}

	return 0;
}

function parsePlayers(raw) {
	if (raw == null || raw === '') {
		return [];
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

		if (!Array.isArray(value)) {
			return [];
		}

		return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
	} catch {
		return [];
	}
}

function userSteamIds(user) {
	const raw = user.get('steamIds');
	if (!raw) {
		return [];
	}

	if (Array.isArray(raw)) {
		return raw.map(String).filter(Boolean);
	}

	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				return parsed.map(String).filter(Boolean);
			}
		} catch {
			return raw ? [raw] : [];
		}
	}

	return [];
}

function playerSteamId(player) {
	if (!player) {
		return '';
	}

	const steam = String(player.steamId || '').trim();
	if (steam) {
		return steam;
	}

	const name = String(player.name || '').trim();
	if (name.startsWith('/steam/')) {
		return name.slice(7);
	}

	const profileName = String(player.profile?.name || '').trim();
	if (profileName.startsWith('/steam/')) {
		return profileName.slice(7);
	}

	return '';
}

function authIsParticipant(auth, lobby) {
	if (!auth || !auth.id) {
		return false;
	}

	const authId = String(auth.id);
	const ownerId = relationId(lobby.get('user'));
	if (ownerId && ownerId === authId) {
		return true;
	}

	let steamIds = [];
	try {
		const user = $app.findRecordById('users', authId);
		steamIds = userSteamIds(user);
	} catch {
		steamIds = [];
	}

	if (steamIds.length > 0) {
		const players = parsePlayers(lobby.get('players'));
		for (let i = 0; i < players.length; i++) {
			const steam = playerSteamId(players[i]);
			if (steam && steamIds.indexOf(steam) !== -1) {
				return true;
			}
		}
	}

	try {
		$app.findFirstRecordByFilter('lobbies_live', 'user = {:user} && lobby = {:lobby}', {
			user: authId,
			lobby: String(lobby.id)
		});
		return true;
	} catch {
		// no live row
	}

	return false;
}

function readUploadedReplay(e) {
	let files;
	try {
		files = e.findUploadedFiles('file');
	} catch (error) {
		console.warn('[lobby-attach-replay] findUploadedFiles', String(error?.message || error));
		throw new Error('Replay file is required.');
	}

	if (!files || !files.length) {
		throw new Error('Replay file is required.');
	}

	const uploaded = files[0];
	const fallbackName = String(uploaded.name || 'replay.rec').trim() || 'replay.rec';
	const tempPath = `${$os.tempDir()}/lobby-attach-${Date.now()}-${String(Math.random()).slice(2, 10)}.rec`;
	const reader = uploaded.reader.open();
	let bytes;
	try {
		bytes = toBytes(reader);
		const size = byteSize(bytes);
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

function storedReplaySize(lobby) {
	const replayName = String(lobby.get('replay') || '').trim();
	if (!replayName) {
		return 0;
	}

	const fsys = $app.newFilesystem();
	try {
		const key = `${lobby.baseFilesPath()}/${replayName}`;
		try {
			const attrs = fsys.attributes(key);
			const size = Number(attrs?.size ?? attrs?.Size);
			if (Number.isFinite(size) && size >= 0) {
				return size;
			}
		} catch {
			// fall through to full read
		}

		const reader = fsys.getReader(key);
		try {
			return byteSize(toBytes(reader));
		} finally {
			reader.close();
		}
	} catch (error) {
		console.warn('[lobby-attach-replay] stored size', String(error?.message || error));
		return 0;
	} finally {
		fsys.close();
	}
}

/**
 * Fields non-owners must not change via the legacy collection update path
 * (older app clients attach replay with PATCH /api/collections/lobbies/...).
 */
const NON_OWNER_LOCKED_FIELDS = [
	'user',
	'isRanked',
	'sessionId',
	'title',
	'map',
	'players',
	'result',
	'needsResult',
	'hasReplay',
	'likeCount',
	'downloadCount',
	'commentCount',
	'durationSeconds',
	'avgElo',
	'memberReplay',
	'lobbyPlayers',
	'playerProfileIdsCsv'
];

function uploadedReplaySize(e) {
	let files;
	try {
		files = e.findUploadedFiles('replay');
	} catch {
		return 0;
	}

	if (!files || !files.length) {
		return 0;
	}

	const uploaded = files[0];
	const declared = Number(uploaded.size ?? uploaded.Size);
	if (Number.isFinite(declared) && declared > 0) {
		return declared;
	}

	const reader = uploaded.reader.open();
	try {
		return byteSize(toBytes(reader));
	} finally {
		reader.close();
	}
}

function restoreLockedFields(record, fieldNames) {
	const original = record.original();
	for (let i = 0; i < fieldNames.length; i++) {
		const name = fieldNames[i];
		record.set(name, original.get(name));
	}
}

/**
 * Back-compat for older apps that PATCH lobbies with a replay file instead of
 * POST /attach-replay. Widened updateRule lets the request through; this guard
 * keeps non-owners to larger-replay attach only.
 */
function guardLegacyCollectionUpdate(e) {
	if (typeof e.hasSuperuserAuth === 'function' && e.hasSuperuserAuth()) {
		e.next();
		return;
	}

	if (!e.auth || !e.auth.id) {
		throw new ForbiddenError('Sign in to update a match.');
	}

	const original = e.record.original();
	const ownerId = relationId(original.get('user'));
	const isOwner = !!(ownerId && ownerId === String(e.auth.id));
	const uploadSize = uploadedReplaySize(e);

	if (!isOwner) {
		if (!authIsParticipant(e.auth, original)) {
			throw new ForbiddenError('Only match participants can update this match.');
		}

		if (!uploadSize) {
			throw new ForbiddenError('Only the match owner can update this match.');
		}

		restoreLockedFields(e.record, NON_OWNER_LOCKED_FIELDS);
	}

	if (uploadSize > 0) {
		const storedSize = storedReplaySize(original);
		if (uploadSize <= storedSize) {
			e.record.set('replay', original.get('replay'));
		}
	}

	e.next();
}

function handleAttach(e) {
	if (!e.auth || !e.auth.id) {
		return jsonNoStore(e, 401, { message: 'Sign in to attach a replay.' });
	}

	const id = String(e.request.pathValue('id') || '').trim();
	if (!id) {
		return jsonNoStore(e, 400, { message: 'id is required' });
	}

	let uploadTempPath = '';
	let uploadSize = 0;
	let fallbackName = 'replay.rec';
	try {
		const uploaded = readUploadedReplay(e);
		uploadTempPath = uploaded.tempPath;
		uploadSize = uploaded.size;
		fallbackName = uploaded.fallbackName;
	} catch (error) {
		const message = String(error?.message || error);
		if (message.includes('too large')) {
			return jsonNoStore(e, 400, { message: 'Replay file is too large.' });
		}

		return jsonNoStore(e, 400, { message: 'Replay file is required.' });
	}

	const cleanup = () => {
		if (!uploadTempPath) {
			return;
		}

		try {
			$os.remove(uploadTempPath);
		} catch {
			// ignore
		}
	};

	let lobby;
	try {
		lobby = $app.findRecordById('lobbies', id);
	} catch {
		cleanup();
		return jsonNoStore(e, 404, { message: 'Match not found.' });
	}

	if (!authIsParticipant(e.auth, lobby)) {
		cleanup();
		return jsonNoStore(e, 403, { message: 'Only match participants can attach a replay.' });
	}

	// Re-load just before compare so concurrent uploads keep the largest file.
	try {
		lobby = $app.findRecordById('lobbies', id);
	} catch {
		cleanup();
		return jsonNoStore(e, 404, { message: 'Match not found.' });
	}

	const storedSize = storedReplaySize(lobby);
	if (uploadSize <= storedSize) {
		cleanup();
		return jsonNoStore(e, 200, {
			id: String(lobby.id),
			attached: false,
			keptExisting: true,
			replaySize: storedSize
		});
	}

	const safeName = fallbackName.toLowerCase().endsWith('.rec')
		? fallbackName.replace(/[^a-zA-Z0-9._-]+/g, '_')
		: 'replay.rec';
	const namedTempPath = `${$os.tempDir()}/${safeName}`;
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
		console.warn('[lobby-attach-replay] rename temp', String(error?.message || error));
	}

	try {
		const filesystemFile = $filesystem.fileFromPath(uploadTempPath);
		lobby.set('replay', filesystemFile);
		$app.save(lobby);

		const savedName = String(lobby.get('replay') || '');
		if (!savedName || savedName === '[object Object]') {
			cleanup();
			return jsonNoStore(e, 500, { message: 'Failed to attach replay.' });
		}

		cleanup();
		return jsonNoStore(e, 200, {
			id: String(lobby.id),
			attached: true,
			keptExisting: false,
			replaySize: uploadSize
		});
	} catch (error) {
		cleanup();
		console.warn('[lobby-attach-replay] save', String(error?.message || error));
		return jsonNoStore(e, 500, { message: 'Failed to attach replay.' });
	}
}

module.exports = {
	handleOptions,
	handleAttach,
	guardLegacyCollectionUpdate
};
