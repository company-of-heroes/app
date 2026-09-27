/**
 * Public player profile customization (bio, links, background).
 * Writes are auth-only via this hook; collection create/update rules stay closed.
 */
'use strict';

const COLLECTION = 'player_customizations';
const MAX_BIO = 500;
const MAX_LINKS = 6;
const MAX_LABEL = 40;
const MAX_FILE_BYTES = 5_242_880;
const BACKGROUND_THUMB = '1600x0';
const ALLOWED_MIME = {
	'image/jpeg': true,
	'image/jpg': true,
	'image/png': true,
	'image/webp': true
};

const ALLOWED_ORIGINS = [
	'https://coh1stats.com',
	'https://www.coh1stats.com',
	'http://localhost:5174',
	'http://127.0.0.1:5174'
];

const STEAM_ID_RE = /^7656119\d{10}$/;

function applyCors(e, methods) {
	const origin = e.request.header.get('Origin');
	if (origin && ALLOWED_ORIGINS.includes(origin)) {
		e.response.header().set('Access-Control-Allow-Origin', origin);
		e.response.header().set('Vary', 'Origin, Authorization');
	} else {
		e.response.header().set('Vary', 'Authorization');
	}

	e.response.header().set('Access-Control-Allow-Methods', methods);
	e.response.header().set(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization'
	);
}

function jsonWithCors(e, status, body, cacheControl) {
	applyCors(e, 'GET, POST, OPTIONS');
	if (cacheControl) {
		e.response.header().set('Cache-Control', cacheControl);
	}

	return e.json(status, body);
}

function jsonNoStore(e, status, body) {
	return jsonWithCors(e, status, body, 'no-store');
}

function handleOptions(e) {
	applyCors(e, 'GET, POST, OPTIONS');
	return e.noContent(204);
}

function bodyField(body, key) {
	if (!body || typeof body !== 'object') {
		return '';
	}

	const value = body[key];
	if (value == null) {
		return '';
	}

	return String(value);
}

function parseSteamId(value) {
	const steamId = String(value || '').trim();
	if (!STEAM_ID_RE.test(steamId)) {
		return '';
	}

	return steamId;
}

function asLinkList(raw) {
	if (raw == null || raw === '') {
		return [];
	}

	let value = raw;

	// goja may expose JSON text as a byte/char-code array
	if (typeof value !== 'string') {
		if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'number') {
			let text = '';
			for (let i = 0; i < value.length; i++) {
				text += String.fromCharCode(value[i]);
			}
			value = text;
		} else if (typeof value === 'object' && typeof value.length === 'number') {
			const looksLikeBytes =
				value.length > 0 && typeof value[0] === 'number' && value[0] >= 0 && value[0] <= 255;
			if (looksLikeBytes) {
				let text = '';
				for (let i = 0; i < value.length; i++) {
					text += String.fromCharCode(value[i]);
				}
				value = text;
			}
		}
	}

	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return [];
		}
	}

	if (Array.isArray(value)) {
		// Real link objects, not a leftover byte array
		if (value.length > 0 && typeof value[0] === 'number') {
			return [];
		}

		return value;
	}

	try {
		const parsed = JSON.parse(JSON.stringify(value));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function parseHttpsUrl(raw) {
	const url = String(raw || '').trim();
	if (!url) {
		return null;
	}

	const match = /^https:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(url);
	if (!match) {
		return null;
	}

	const host = String(match[1] || '')
		.trim()
		.toLowerCase()
		.replace(/\.$/, '');
	if (!host || host.indexOf('.') === -1) {
		return null;
	}

	return {
		hostname: host.split(':')[0],
		href: url
	};
}

/** Strict validation for writes. */
function parseLinks(raw) {
	const value = asLinkList(raw);
	if (value.length > MAX_LINKS) {
		throw new Error('You can add at most 6 links.');
	}

	const out = [];
	for (let i = 0; i < value.length; i++) {
		const item = value[i] || {};
		const type = String(item.type || '').trim().toLowerCase();
		const url = String(item.url || '').trim();
		const label = String(item.label || '').trim().slice(0, MAX_LABEL);

		if (type !== 'twitch' && type !== 'youtube' && type !== 'other') {
			throw new Error('Each link must be twitch, youtube, or other.');
		}

		if (!url) {
			continue;
		}

		const parsed = parseHttpsUrl(url);
		if (!parsed) {
			throw new Error('Enter a valid https URL for each link.');
		}

		const host = parsed.hostname;
		if (type === 'twitch') {
			if (host !== 'twitch.tv' && host !== 'www.twitch.tv') {
				throw new Error('Twitch links must be on twitch.tv.');
			}
		} else if (type === 'youtube') {
			const ok =
				host === 'youtube.com' ||
				host === 'www.youtube.com' ||
				host === 'm.youtube.com' ||
				host === 'youtu.be';
			if (!ok) {
				throw new Error('YouTube links must be on youtube.com or youtu.be.');
			}
		}

		if (type === 'other' && !label) {
			throw new Error('Other links need a label.');
		}

		const link = { type, url: parsed.href };
		if (type === 'other') {
			link.label = label;
		}

		out.push(link);
	}

	return out;
}

/** Lenient read for public display — never throw away stored links. */
function linksFromRecord(raw) {
	const value = asLinkList(raw);
	const out = [];
	for (let i = 0; i < value.length && out.length < MAX_LINKS; i++) {
		const item = value[i] || {};
		const type = String(item.type || '').trim().toLowerCase();
		const url = String(item.url || '').trim();
		const label = String(item.label || '').trim().slice(0, MAX_LABEL);
		if (type !== 'twitch' && type !== 'youtube' && type !== 'other') {
			continue;
		}

		if (!url) {
			continue;
		}

		const link = { type, url };
		if (type === 'other' && label) {
			link.label = label;
		} else if (label) {
			link.label = label;
		}

		out.push(link);
	}

	return out;
}

function emptyCustomization() {
	return {
		bio: null,
		links: [],
		backgroundUrl: null
	};
}

function filePublicUrl(record, filename, thumb) {
	if (!filename) {
		return null;
	}

	const base = String($app.settings().meta.appURL || '')
		.trim()
		.replace(/\/$/, '');
	const params = [];
	if (thumb) {
		params.push(`thumb=${encodeURIComponent(thumb)}`);
	}

	// Bust browser image cache when the file is replaced (filename often stays similar).
	const updated = record.get('updated');
	if (updated) {
		params.push(`v=${encodeURIComponent(String(updated))}`);
	}

	let path = `/api/files/${COLLECTION}/${record.id}/${encodeURIComponent(filename)}`;
	if (params.length > 0) {
		path += `?${params.join('&')}`;
	}

	if (!base) {
		return path;
	}

	return `${base}${path}`;
}

function serializeRecord(record) {
	if (!record) {
		return emptyCustomization();
	}

	const bio = String(record.get('bio') || '').trim();
	const background = String(record.get('background') || '').trim();

	return {
		bio: bio || null,
		links: linksFromRecord(record.get('links')),
		backgroundUrl: filePublicUrl(record, background, BACKGROUND_THUMB)
	};
}

function findBySteamId(steamId) {
	if (!steamId) {
		return null;
	}

	try {
		return $app.findFirstRecordByFilter(COLLECTION, 'steam_id = {:steamId}', { steamId });
	} catch {
		return null;
	}
}

function findUserIdBySteamId(steamId) {
	if (!steamId) {
		return '';
	}

	try {
		const escaped = String(steamId).replace(/"/g, '\\"');
		const user = $app.findFirstRecordByFilter('users', `steamIds ~ "${escaped}"`);
		return user ? String(user.id) : '';
	} catch {
		return '';
	}
}

function findByUserId(userId) {
	if (!userId) {
		return null;
	}

	try {
		const rows = $app.findRecordsByFilter(COLLECTION, 'user = {:userId}', '-updated', 20, 0, {
			userId
		});
		if (!rows || !rows.length) {
			return null;
		}

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const bio = String(row.get('bio') || '').trim();
			const background = String(row.get('background') || '').trim();
			const links = linksFromRecord(row.get('links'));
			if (bio || background || links.length > 0) {
				return row;
			}
		}

		return rows[0];
	} catch {
		return null;
	}
}

function loadCustomization(steamId) {
	const id = parseSteamId(steamId);
	if (!id) {
		return emptyCustomization();
	}

	const direct = findBySteamId(id);
	if (direct) {
		const serialized = serializeRecord(direct);
		if (serialized.bio || serialized.backgroundUrl || serialized.links.length > 0) {
			return serialized;
		}
	}

	// Same account often has multiple Steam IDs; customization may live on another one.
	const userId = findUserIdBySteamId(id);
	if (userId) {
		const shared = findByUserId(userId);
		if (shared && (!direct || String(shared.id) !== String(direct.id))) {
			return serializeRecord(shared);
		}
	}

	return serializeRecord(direct);
}

function backgroundTempFromRecord(record) {
	const name = String(record.get('background') || '').trim();
	if (!name || !record) {
		return '';
	}

	try {
		const fsys = $app.newFilesystem();
		try {
			const key = `${record.baseFilesPath()}/${name}`;
			const reader = fsys.getReader(key);
			try {
				const bytes = toBytes(reader);
				const size = byteSize(bytes);
				if (!size) {
					return '';
				}

				const ext = extensionForMime('', name);
				const tempPath = `${$os.tempDir()}/player-bg-copy-${Date.now()}-${String(Math.random()).slice(2, 10)}.${ext}`;
				$os.writeFile(tempPath, bytes, 0o644);
				return tempPath;
			} finally {
				reader.close();
			}
		} finally {
			try {
				fsys.close();
			} catch {
				// ignore
			}
		}
	} catch (error) {
		console.warn('[player-customization] copy background', String(error?.message || error));
		return '';
	}
}

function authOwnsSteamId(auth, steamId) {
	if (!auth || !auth.id || !steamId) {
		return false;
	}

	const ids = require(`${__hooks}/lib/match-history.js`).loadUserSteamIds(String(auth.id));
	return ids.indexOf(steamId) !== -1;
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

function extensionForMime(mime, fallbackName) {
	const lower = String(fallbackName || '').toLowerCase();
	if (lower.endsWith('.png') || mime === 'image/png') {
		return 'png';
	}

	if (lower.endsWith('.webp') || mime === 'image/webp') {
		return 'webp';
	}

	// Prefer .jpeg so OS/PB mime maps never invent non-standard image/jpg.
	return 'jpeg';
}

function byteAt(bytes, index) {
	if (bytes == null || index < 0) {
		return -1;
	}

	const value = bytes[index];
	if (typeof value === 'number') {
		return value & 0xff;
	}

	if (typeof bytes.charCodeAt === 'function') {
		return bytes.charCodeAt(index) & 0xff;
	}

	return -1;
}

function sniffImageMime(bytes) {
	const size = byteSize(bytes);
	if (size < 3) {
		return '';
	}

	// JPEG
	if (byteAt(bytes, 0) === 0xff && byteAt(bytes, 1) === 0xd8 && byteAt(bytes, 2) === 0xff) {
		return 'image/jpeg';
	}

	// PNG
	if (
		size >= 8 &&
		byteAt(bytes, 0) === 0x89 &&
		byteAt(bytes, 1) === 0x50 &&
		byteAt(bytes, 2) === 0x4e &&
		byteAt(bytes, 3) === 0x47
	) {
		return 'image/png';
	}

	// WEBP: RIFF....WEBP
	if (
		size >= 12 &&
		byteAt(bytes, 0) === 0x52 &&
		byteAt(bytes, 1) === 0x49 &&
		byteAt(bytes, 2) === 0x46 &&
		byteAt(bytes, 3) === 0x46 &&
		byteAt(bytes, 8) === 0x57 &&
		byteAt(bytes, 9) === 0x45 &&
		byteAt(bytes, 10) === 0x42 &&
		byteAt(bytes, 11) === 0x50
	) {
		return 'image/webp';
	}

	return '';
}

function mimeFromFilename(name) {
	const lower = String(name || '').toLowerCase();
	if (lower.endsWith('.png')) {
		return 'image/png';
	}

	if (lower.endsWith('.webp')) {
		return 'image/webp';
	}

	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
		return 'image/jpeg';
	}

	return '';
}

function readUploadedBackground(e) {
	let files;
	try {
		files = e.findUploadedFiles('background');
	} catch {
		return null;
	}

	if (!files || !files.length) {
		return null;
	}

	const uploaded = files[0];
	const fallbackName = String(uploaded.name || 'background.jpeg').trim() || 'background.jpeg';
	const declaredSize = Number(uploaded.size) || 0;
	if (declaredSize > MAX_FILE_BYTES) {
		throw new Error('Background must be 5 MB or smaller.');
	}

	// Prefer multipart → File so binary stays intact (toBytes/writeFile can corrupt images).
	// Fall back to temp path + magic-byte sniff when we can read bytes.
	const reader = uploaded.reader.open();
	let bytes = null;
	try {
		if (typeof toBytes === 'function') {
			bytes = toBytes(reader);
		}
	} finally {
		reader.close();
	}

	const size = bytes != null ? byteSize(bytes) : declaredSize;
	if (!size) {
		throw new Error('Background image is empty.');
	}

	if (size > MAX_FILE_BYTES) {
		throw new Error('Background must be 5 MB or smaller.');
	}

	const sniffed = bytes != null ? sniffImageMime(bytes) : '';
	const rawMime = String(uploaded.contentType || uploaded.type || '').toLowerCase();
	const mime =
		sniffed ||
		(ALLOWED_MIME[rawMime] ? (rawMime === 'image/jpg' ? 'image/jpeg' : rawMime) : '') ||
		mimeFromFilename(fallbackName);

	if (!mime || !ALLOWED_MIME[mime === 'image/jpg' ? 'image/jpeg' : mime]) {
		throw new Error('Background must be a jpeg, png, or webp image.');
	}

	const normalizedMime = mime === 'image/jpg' ? 'image/jpeg' : mime;
	const ext = extensionForMime(normalizedMime, fallbackName);

	if (bytes != null) {
		const tempPath = `${$os.tempDir()}/player-bg-${Date.now()}-${String(Math.random()).slice(2, 10)}.${ext}`;
		$os.writeFile(tempPath, bytes, 0o644);
		return { tempPath, fallbackName: `background.${ext}` };
	}

	return {
		file: $filesystem.fileFromMultipart(uploaded),
		fallbackName: `background.${ext}`
	};
}

function handleGet(e) {
	const steamId = parseSteamId(e.request.pathValue('steamId'));
	if (!steamId) {
		return jsonWithCors(e, 400, { message: 'Enter a valid Steam ID64.' }, 'no-store');
	}

	// Owner-edited fields; never serve a stale bio/links/background after a save.
	return jsonWithCors(e, 200, loadCustomization(steamId), 'no-store');
}

function applyCustomizationFields(record, authId, steamId, bio, links, options) {
	record.set('steam_id', steamId);
	record.set('user', authId);
	record.set('bio', bio);
	// JSON fields are more reliable as a string in the JSVM.
	record.set('links', JSON.stringify(links));

	if (options.clearBackground && !options.uploadTempPath && !options.uploadFile) {
		record.set('background', null);
	}

	if (options.uploadFile) {
		record.set('background', options.uploadFile);
	} else if (options.uploadTempPath) {
		record.set('background', $filesystem.fileFromPath(options.uploadTempPath));
	}
}

function syncOwnedSteamIds(authId, primarySteamId, bio, links, options) {
	const ids = require(`${__hooks}/lib/match-history.js`).loadUserSteamIds(String(authId));
	const collection = $app.findCollectionByNameOrId(COLLECTION);

	for (let i = 0; i < ids.length; i++) {
		const sid = ids[i];
		if (!sid || sid === primarySteamId) {
			continue;
		}

		try {
			let record = findBySteamId(sid);
			if (!record) {
				record = new Record(collection);
			}

			applyCustomizationFields(record, authId, sid, bio, links, options);
			$app.save(record);
		} catch (error) {
			console.warn('[player-customization] sync', sid, String(error?.message || error));
		}
	}
}

function handleUpdate(e) {
	if (!e.auth || !e.auth.id) {
		return jsonNoStore(e, 401, { message: 'Log in to update your profile.' });
	}

	let upload = null;
	try {
		upload = readUploadedBackground(e);
	} catch (error) {
		return jsonNoStore(e, 400, { message: String(error?.message || error) });
	}

	const body = e.requestInfo()?.body || {};
	const steamId = parseSteamId(bodyField(body, 'steamId'));
	if (!steamId) {
		if (upload?.tempPath) {
			try {
				$os.remove(upload.tempPath);
			} catch {
				// ignore
			}
		}

		return jsonNoStore(e, 400, { message: 'Enter a valid Steam ID64.' });
	}

	if (!authOwnsSteamId(e.auth, steamId)) {
		if (upload?.tempPath) {
			try {
				$os.remove(upload.tempPath);
			} catch {
				// ignore
			}
		}

		return jsonNoStore(e, 403, {
			message: 'Link this Steam ID to your account before editing that profile.'
		});
	}

	let links = [];
	try {
		const linksRaw = body.links != null ? body.links : bodyField(body, 'links');
		if (linksRaw === '' || linksRaw == null) {
			links = [];
		} else {
			links = parseLinks(linksRaw);
		}
	} catch (error) {
		if (upload?.tempPath) {
			try {
				$os.remove(upload.tempPath);
			} catch {
				// ignore
			}
		}

		return jsonNoStore(e, 400, { message: String(error?.message || error) });
	}

	const bio = bodyField(body, 'bio').trim().slice(0, MAX_BIO);
	const clearBackground =
		bodyField(body, 'clearBackground') === '1' ||
		bodyField(body, 'clearBackground') === 'true';
	const fieldOptions = {
		clearBackground,
		uploadTempPath: upload && upload.tempPath ? upload.tempPath : '',
		uploadFile: upload && upload.file ? upload.file : null
	};

	try {
		const collection = $app.findCollectionByNameOrId(COLLECTION);
		let record = findBySteamId(steamId);
		if (!record) {
			record = new Record(collection);
		}

		applyCustomizationFields(record, e.auth.id, steamId, bio, links, fieldOptions);
		$app.save(record);

		let copiedBackground = '';
		// Don't reuse the multipart File across records — copy from the saved primary.
		const syncOptions = {
			clearBackground,
			uploadTempPath: '',
			uploadFile: null
		};
		if (!clearBackground) {
			if (fieldOptions.uploadTempPath) {
				syncOptions.uploadTempPath = fieldOptions.uploadTempPath;
			} else {
				copiedBackground = backgroundTempFromRecord(record);
				if (copiedBackground) {
					syncOptions.uploadTempPath = copiedBackground;
				}
			}
		}

		try {
			syncOwnedSteamIds(e.auth.id, steamId, bio, links, syncOptions);
		} finally {
			if (copiedBackground) {
				try {
					$os.remove(copiedBackground);
				} catch {
					// ignore
				}
			}
		}

		if (upload?.tempPath) {
			try {
				$os.remove(upload.tempPath);
			} catch {
				// ignore
			}
		}

		return jsonNoStore(e, 200, serializeRecord(record));
	} catch (error) {
		if (upload?.tempPath) {
			try {
				$os.remove(upload.tempPath);
			} catch {
				// ignore
			}
		}

		console.warn('[player-customization] save', String(error?.message || error));
		const detail = String(error?.message || error || '').trim();
		return jsonNoStore(e, 500, {
			message:
				detail && detail.length < 180 && !/stack|goroutine|panic/i.test(detail)
					? detail
					: 'Could not update your profile.'
		});
	}
}

module.exports = {
	handleOptions,
	handleGet,
	handleUpdate,
	loadCustomization,
	emptyCustomization
};
