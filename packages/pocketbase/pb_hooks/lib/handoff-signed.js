'use strict';

const TTL_MS = 5 * 60_000;
const STORE_PREFIX = 'auth_handoff_used:';
const HANDOFF_VERSION = 'signed-v1';

function handoffSecret() {
	return $os.getenv('AUTH_HANDOFF_SECRET') || 'coh1stats-auth-handoff-dev';
}

function createHandoff(userId) {
	const id = String(userId || '').trim();
	if (!id) {
		throw new BadRequestError('Invalid or expired login code.');
	}

	const expiresAt = Date.now() + TTL_MS;
	const body = `${id}.${expiresAt}`;
	const signature = String($security.sha256(`${body}|${handoffSecret()}`) || '').toLowerCase();
	return `${HANDOFF_VERSION}.${body}.${signature}`;
}

function parseHandoffCode(code) {
	const raw = String(code || '').trim();
	if (!raw) {
		return null;
	}

	if (raw.startsWith(`${HANDOFF_VERSION}.`)) {
		const parts = raw.slice(HANDOFF_VERSION.length + 1).split('.');
		if (parts.length !== 3) {
			return null;
		}

		return {
			userId: parts[0],
			expiresAtRaw: parts[1],
			signature: parts[2]
		};
	}

	const legacyParts = raw.split('|');
	if (legacyParts.length !== 3) {
		return null;
	}

	return {
		userId: legacyParts[0],
		expiresAtRaw: legacyParts[1],
		signature: legacyParts[2]
	};
}

function readRequestJsonBody(e) {
	try {
		const body = e.requestInfo()?.body;
		if (body && typeof body === 'object' && Object.keys(body).length > 0) {
			return body;
		}
	} catch (error) {
		console.warn('[auth_handoff] requestInfo body failed', String(error?.message || error));
	}

	try {
		const raw = toString(e.request.body);
		if (raw) {
			return JSON.parse(raw);
		}
	} catch (error) {
		console.warn('[auth_handoff] raw body parse failed', String(error?.message || error));
	}

	return null;
}

function validateHandoff(code) {
	const parsed = parseHandoffCode(code);
	if (!parsed) {
		throw new BadRequestError('Invalid or expired login code.');
	}

	const { userId, expiresAtRaw, signature } = parsed;
	const expiresAt = Number(expiresAtRaw);
	const body = `${userId}.${expiresAtRaw}`;
	const expected = String($security.sha256(`${body}|${handoffSecret()}`) || '').toLowerCase();

	if (!userId || !signature || signature !== expected) {
		throw new BadRequestError('Invalid or expired login code.');
	}

	if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
		throw new BadRequestError('Invalid or expired login code.');
	}

	return { userId, signature };
}

function exchangeHandoff(code) {
	return validateHandoff(code).userId;
}

function handleCreate(e) {
	const auth = e.auth;
	if (!auth) {
		throw new UnauthorizedError('You must be signed in.');
	}

	const code = createHandoff(auth.id);
	return e.json(200, { code });
}

function handleExchange(e) {
	const body = readRequestJsonBody(e);
	if (body == null) {
		throw new BadRequestError('Invalid JSON body.');
	}

	const code = typeof body.code === 'string' ? body.code.trim() : '';
	if (!code) {
		throw new BadRequestError('code is required.');
	}

	const { userId, signature } = validateHandoff(code);
	const user = $app.findRecordById('users', userId);
	const usedKey = STORE_PREFIX + signature;
	// Mark after lookup so a failed auth response does not burn the link.
	// Re-exchange within TTL stays allowed (prefetch / double-load safe).
	if (!$app.store().get(usedKey)) {
		$app.store().set(usedKey, String(Date.now()));
	}

	return $apis.recordAuthResponse(e, user);
}

module.exports = {
	createHandoff,
	exchangeHandoff,
	handleCreate,
	handleExchange
};
