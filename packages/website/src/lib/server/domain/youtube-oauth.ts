/**
 * Signed state for Google OAuth (desktop → website → Google → website → app)
 * and short-lived token handoff codes swapped by the desktop for access/refresh tokens.
 */

export const YOUTUBE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const YOUTUBE_TOKEN_HANDOFF_TTL_MS = 5 * 60 * 1000;
export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
export const YOUTUBE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Loopback ports the desktop Tauri OAuth plugin listens on. */
export const YOUTUBE_APP_PORTS = new Set([8001, 8002, 8003, 8004, 8005]);

export type YoutubeOauthState = {
	redirectUri: string;
	clientState: string;
	verifier: string;
};

export type YoutubeTokenBundle = {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
};

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sameText(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
	const padded = value.replace(/-/g, '+').replace(/_/g, '/');
	const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
	const binary = atob(padded + pad);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function encodeJson(value: unknown): string {
	return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T | null {
	try {
		return JSON.parse(new TextDecoder().decode(base64UrlDecode(value))) as T;
	} catch {
		return null;
	}
}

/** Only the desktop loopback listener (http://localhost|127.0.0.1:8001–8005). */
export function isAllowedAppRedirect(raw: string): boolean {
	try {
		const url = new URL(raw);
		if (url.protocol !== 'http:') {
			return false;
		}

		if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
			return false;
		}

		if (url.pathname !== '/' && url.pathname !== '') {
			return false;
		}

		if (url.username || url.password || url.search || url.hash) {
			return false;
		}

		const port = Number(url.port);
		return YOUTUBE_APP_PORTS.has(port);
	} catch {
		return false;
	}
}

export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
	const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)) };
}

/** `{payload}.{expiresAt}.{sig}` carried through Google as `state`. */
export async function createOauthState(
	payload: YoutubeOauthState,
	secret: string,
	now = Date.now()
): Promise<string> {
	const body = `${encodeJson(payload)}.${now + YOUTUBE_OAUTH_STATE_TTL_MS}`;
	return `${body}.${await sha256(`${body}|${secret}`)}`;
}

export async function readOauthState(
	raw: string,
	secret: string,
	now = Date.now()
): Promise<YoutubeOauthState | null> {
	const parts = raw.trim().split('.');
	if (parts.length !== 3) {
		return null;
	}

	const [payload, expiresAt, signature] = parts;
	const expected = await sha256(`${payload}.${expiresAt}|${secret}`);
	if (!sameText(signature, expected) || !(Number(expiresAt) > now)) {
		return null;
	}

	const parsed = decodeJson<YoutubeOauthState>(payload);
	if (
		!parsed?.redirectUri ||
		!parsed.clientState ||
		!parsed.verifier ||
		!isAllowedAppRedirect(parsed.redirectUri)
	) {
		return null;
	}

	return parsed;
}

/** Short-lived code the desktop redeems for Google tokens (secret stays on the website). */
export async function createTokenHandoff(
	tokens: YoutubeTokenBundle,
	secret: string,
	now = Date.now()
): Promise<string> {
	const body = `${encodeJson(tokens)}.${now + YOUTUBE_TOKEN_HANDOFF_TTL_MS}`;
	return `yt1.${body}.${await sha256(`${body}|${secret}`)}`;
}

export async function readTokenHandoff(
	raw: string,
	secret: string,
	now = Date.now()
): Promise<YoutubeTokenBundle | null> {
	const value = raw.trim();
	if (!value.startsWith('yt1.')) {
		return null;
	}

	const parts = value.slice(4).split('.');
	if (parts.length !== 3) {
		return null;
	}

	const [payload, expiresAt, signature] = parts;
	const expected = await sha256(`${payload}.${expiresAt}|${secret}`);
	if (!sameText(signature, expected) || !(Number(expiresAt) > now)) {
		return null;
	}

	const parsed = decodeJson<YoutubeTokenBundle>(payload);
	if (!parsed?.access_token || typeof parsed.expires_in !== 'number') {
		return null;
	}

	return parsed;
}
