'use strict';

const FILE_PATH_PREFIXES = ['/api/files/lobbies/', '/api/files/replays/'];
const TOO_MANY = 'Too many download requests';

const FILE_ANON = [
	{ suffix: 'burst', windowMs: 10_000, max: 8 },
	{ suffix: '', windowMs: 60_000, max: 40 }
];
const FILE_AUTH = [
	{ suffix: 'burst', windowMs: 10_000, max: 20 },
	{ suffix: '', windowMs: 60_000, max: 90 }
];
const COUNT = [
	{ suffix: 'burst', windowMs: 10_000, max: 10 },
	{ suffix: '', windowMs: 60_000, max: 30 }
];
const FILE_GLOBAL = [
	{ key: 'file:global:burst', windowMs: 10_000, max: 40 },
	{ key: 'file:global', windowMs: 60_000, max: 400 }
];

const buckets = new Map();
let consumeCount = 0;

function isIp(value) {
	return typeof value === 'string' && value.length > 0 && value.length <= 45 && /^[0-9a-fA-F.:]+$/.test(value);
}

function isPrivateIp(ip) {
	if (!ip) return false;
	const value = ip.replace(/^::ffff:/i, '').toLowerCase();
	if (value === '127.0.0.1' || value === '::1' || value === 'localhost') return true;
	if (value.startsWith('10.') || value.startsWith('192.168.') || value.startsWith('169.254.')) return true;
	const match = value.match(/^172\.(\d+)\./);
	if (!match) return false;
	const octet = Number(match[1]);
	return octet >= 16 && octet <= 31;
}

function headerIp(e, name) {
	const value = String(e.request.header.get(name) || '')
		.split(',')[0]
		.trim();
	return isIp(value) ? value : '';
}

function rawRealIp(e) {
	try {
		if (typeof e.realIP === 'function') {
			const ip = String(e.realIP() || '').trim();
			if (isIp(ip)) return ip;
		}
	} catch {
		// fall through
	}
	return '';
}

function proxySecret() {
	try {
		return String($os.getenv('REPLAY_PROXY_SECRET') || '');
	} catch {
		return '';
	}
}

function isTrustedProxy(e, realIp) {
	const secret = proxySecret();
	const provided = String(e.request.header.get('X-Replay-Proxy') || '');
	if (secret && provided && secret === provided) return true;
	return isPrivateIp(realIp);
}

function clientIp(e) {
	const real = rawRealIp(e);
	const forwarded = headerIp(e, 'X-Client-IP') || headerIp(e, 'CF-Connecting-IP');
	if (isTrustedProxy(e, real) && forwarded) {
		return forwarded;
	}

	if (real) {
		return real;
	}

	return 'unknown';
}

function requestPath(e) {
	try {
		const url = e.request.url;
		if (url && typeof url.path === 'string' && url.path) return url.path;
		let raw = String(url || '');
		const scheme = raw.indexOf('://');
		if (scheme !== -1) {
			const pathStart = raw.indexOf('/', scheme + 3);
			raw = pathStart === -1 ? '/' : raw.slice(pathStart);
		}
		const query = raw.indexOf('?');
		if (query !== -1) raw = raw.slice(0, query);
		return raw;
	} catch {
		return '';
	}
}

function requestMethod(e) {
	try {
		return String(e.request.method || 'GET').toUpperCase();
	} catch {
		return 'GET';
	}
}

function pruneBucket(key, now) {
	const bucket = buckets.get(key);
	if (!bucket) return [];
	bucket.times = bucket.times.filter((time) => now - time < bucket.keepMs);
	if (!bucket.times.length) {
		buckets.delete(key);
		return [];
	}
	return bucket.times;
}

function retryAfterSec(times, windowMs, now) {
	if (!times.length) return 1;
	return Math.max(1, Math.ceil((windowMs - (now - times[0])) / 1000));
}

function namedChecks(ip, name, windows) {
	return windows.map((window) => ({
		key: window.suffix ? `${name}:${ip}:${window.suffix}` : `${name}:${ip}`,
		windowMs: window.windowMs,
		max: window.max
	}));
}

function allow(checks) {
	const now = Date.now();
	consumeCount += 1;
	if (consumeCount % 200 === 0) {
		for (const key of [...buckets.keys()]) pruneBucket(key, now);
	}
	for (const check of checks) {
		const times = pruneBucket(check.key, now);
		if (times.length >= check.max) {
			return { ok: false, retryAfter: retryAfterSec(times, check.windowMs, now) };
		}
	}
	for (const check of checks) {
		let bucket = buckets.get(check.key);
		if (!bucket) {
			bucket = { times: [], keepMs: check.windowMs };
			buckets.set(check.key, bucket);
		}
		if (check.windowMs > bucket.keepMs) bucket.keepMs = check.windowMs;
		bucket.times.push(now);
	}
	return { ok: true, retryAfter: 0 };
}

function reject(e, retryAfter) {
	e.response.header().set('Retry-After', String(retryAfter || 1));
	e.response.header().set('Cache-Control', 'no-store');
	return e.json(429, { message: TOO_MANY, retryAfter: retryAfter || 1 });
}

function limitFileRequest(e) {
	try {
		const method = requestMethod(e);
		if (method !== 'GET' && method !== 'HEAD') return null;
		const path = requestPath(e);
		if (!FILE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
		const ip = clientIp(e);
		const windows = e.auth?.id ? FILE_AUTH : FILE_ANON;
		const name = e.auth?.id ? 'file-auth' : 'file';
		const result = allow([...namedChecks(ip, name, windows), ...FILE_GLOBAL]);
		if (!result.ok) return reject(e, result.retryAfter);
		return null;
	} catch (error) {
		console.warn('[download-rate-limit] file', String(error?.message || error));
		return null;
	}
}

function limitCountRequest(e) {
	try {
		return allow(namedChecks(clientIp(e), 'count', COUNT));
	} catch (error) {
		console.warn('[download-rate-limit] count', String(error?.message || error));
		return { ok: true, retryAfter: 0 };
	}
}

module.exports = {
	clientIp,
	limitFileRequest,
	limitCountRequest,
	TOO_MANY
};
