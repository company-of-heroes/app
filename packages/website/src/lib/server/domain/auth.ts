/**
 * Signed, short-lived values for logging in: handoff codes (app → browser, Steam
 * login → site) and the Steam OpenID state. Same formats and hashes as the
 * PocketBase hooks they replace, so codes issued by either side keep working.
 */

export const HANDOFF_TTL_MS = 5 * 60 * 1000;
export const STEAM_STATE_TTL_MS = 10 * 60 * 1000;
export const STEAM_OPENID_LOGIN = 'https://steamcommunity.com/openid/login';

const HANDOFF_VERSION = 'signed-v1';
const CLAIMED_ID_PREFIX = 'https://steamcommunity.com/openid/id/';
const STEAM_ID = /^7656119\d{10}$/;

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(text: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
	return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A random value tying a Steam login to the browser that started it. */
export function loginNonce(): string {
	return [...crypto.getRandomValues(new Uint8Array(16))]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

export function sameText(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

/** `signed-v1.{userId}.{expiresAt}.{sha256(body|secret)}` */
export async function createHandoffCode(
	userId: string,
	secret: string,
	now = Date.now()
): Promise<string> {
	const body = `${userId}.${now + HANDOFF_TTL_MS}`;
	return `${HANDOFF_VERSION}.${body}.${await sha256(`${body}|${secret}`)}`;
}

/** The user a handoff code signs in, or null when it is forged or expired (older `a|b|c` codes too). */
export async function readHandoffCode(
	code: string,
	secret: string,
	now = Date.now()
): Promise<string | null> {
	const raw = code.trim();
	const parts = raw.startsWith(`${HANDOFF_VERSION}.`)
		? raw.slice(HANDOFF_VERSION.length + 1).split('.')
		: raw.split('|');
	if (parts.length !== 3) {
		return null;
	}

	const [userId, expiresAt, signature] = parts;
	const expected = await sha256(`${userId}.${expiresAt}|${secret}`);
	if (!userId || !sameText(signature.toLowerCase(), expected) || !(Number(expiresAt) > now)) {
		return null;
	}

	return userId;
}

/** Only same-site paths ("/x"), never "//host" or backslashes. */
export function safeRedirectPath(raw: unknown): string {
	const value = String(raw ?? '/').trim() || '/';
	return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';
}

/**
 * `{origin}~{redirect}~{expiresAt}~{nonce}~{hmac}`, carried through Steam's login. The
 * nonce is also in a cookie of the browser that started the login (see `steamCallback`).
 */
export async function createSteamState(
	origin: string,
	redirect: string,
	nonce: string,
	secret: string,
	now = Date.now()
): Promise<string> {
	const body = `${encodeURIComponent(origin)}~${encodeURIComponent(redirect)}~${now + STEAM_STATE_TTL_MS}~${nonce}`;
	return `${body}~${await hmacSha256(body, secret)}`;
}

export async function readSteamState(
	raw: string,
	secret: string,
	allowedOrigins: string[],
	now = Date.now()
): Promise<{ origin: string; redirect: string; nonce: string } | null> {
	const parts = raw.trim().split('~');
	if (parts.length !== 5) {
		return null;
	}

	const [origin, redirect, expiresAt, nonce, signature] = parts;
	const expected = await hmacSha256(`${origin}~${redirect}~${expiresAt}~${nonce}`, secret);
	if (!nonce || !sameText(signature, expected) || !(Number(expiresAt) > now)) {
		return null;
	}

	try {
		const decoded = decodeURIComponent(origin).replace(/\/$/, '');
		return allowedOrigins.includes(decoded)
			? { origin: decoded, redirect: safeRedirectPath(decodeURIComponent(redirect)), nonce }
			: null;
	} catch {
		return null;
	}
}

export function steamLoginUrl(returnTo: string, realm: string): string {
	const params = new URLSearchParams({
		'openid.ns': 'http://specs.openid.net/auth/2.0',
		'openid.mode': 'checkid_setup',
		'openid.return_to': returnTo,
		'openid.realm': realm,
		'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
		'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
	});
	return `${STEAM_OPENID_LOGIN}?${params}`;
}

/** The `openid.*` params Steam sent back, to verify with Steam (mode check_authentication). */
export function openIdParams(query: URLSearchParams): Record<string, string> {
	return Object.fromEntries([...query].filter(([key]) => key.startsWith('openid.')));
}

/** Did Steam return to one of our callbacks (it appends its own query)? */
export function returnsTo(returnTo: string, callbacks: string[]): boolean {
	return callbacks.some(
		(base) =>
			returnTo === base || returnTo.startsWith(`${base}?`) || returnTo.startsWith(`${base}&`)
	);
}

export function steamIdFromClaim(claimedId: string): string | null {
	if (!claimedId.startsWith(CLAIMED_ID_PREFIX)) {
		return null;
	}

	const steamId = claimedId.slice(CLAIMED_ID_PREFIX.length).replace(/\/$/, '');
	return STEAM_ID.test(steamId) ? steamId : null;
}
