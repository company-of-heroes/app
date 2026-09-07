'use strict';

const { createHandoff } = require(`${__hooks}/lib/handoff-signed.js`);

const STEAM_OPENID_LOGIN = 'https://steamcommunity.com/openid/login';
const STEAM_ID_REGEX = /^7656119\d{10}$/;
const CLAIMED_ID_PREFIX = 'https://steamcommunity.com/openid/id/';
const STATE_TTL_MS = 10 * 60 * 1000;

const ALLOWED_LANDING_ORIGINS = [
	'https://coh1stats.com',
	'https://www.coh1stats.com',
	'http://localhost:5174',
	'http://127.0.0.1:5174'
];

function stateSecret() {
	return $os.getenv('AUTH_HANDOFF_SECRET') || 'coh1stats-auth-handoff-dev';
}

function apiPublicBase(e) {
	const configured = String($os.getenv('PB_PUBLIC_URL') || '').replace(/\/$/, '');
	if (configured) {
		return configured;
	}

	const headerHost = String(e.request.header.get('Host') || '').trim();
	const forwardedProto = String(e.request.header.get('X-Forwarded-Proto') || '')
		.split(',')[0]
		.trim()
		.toLowerCase();

	let host = headerHost;
	let scheme = forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : '';

	if (!host) {
		try {
			host = String(e.request.url?.host || '').trim();
		} catch {
			host = '';
		}
	}

	if (!scheme) {
		try {
			scheme = String(e.request.url?.scheme || '').trim().toLowerCase();
		} catch {
			scheme = '';
		}
	}

	if (!host) {
		try {
			const raw = String(e.request.url || '');
			const match = raw.match(/^(https?):\/\/([^/?#]+)/i);
			if (match) {
				scheme = scheme || match[1].toLowerCase();
				host = match[2];
			}
		} catch {
			// ignore
		}
	}

	if (!host) {
		// Local PocketBase default when Host / URL fields are unavailable in JSVM.
		return 'http://127.0.0.1:8090';
	}

	if (!scheme) {
		const lower = host.toLowerCase();
		scheme =
			lower.startsWith('localhost') ||
			lower.startsWith('127.0.0.1') ||
			lower.startsWith('[::1]') ||
			lower.startsWith('0.0.0.0')
				? 'http'
				: 'https';
	}

	return `${scheme}://${host}`;
}

function isAllowedLandingOrigin(origin) {
	return ALLOWED_LANDING_ORIGINS.includes(String(origin || '').replace(/\/$/, ''));
}

function safeRedirectPath(raw) {
	const value = String(raw || '/').trim() || '/';
	if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
		return '/';
	}

	return value;
}

function createState(origin, redirect) {
	const expiresAt = Date.now() + STATE_TTL_MS;
	const body = `${encodeURIComponent(origin)}~${encodeURIComponent(redirect)}~${expiresAt}`;
	const signature = String($security.sha256(`${body}|${stateSecret()}`) || '').toLowerCase();
	return `${body}~${signature}`;
}

function parseState(raw) {
	const value = String(raw || '').trim();
	if (!value) {
		return null;
	}

	const parts = value.split('~');
	if (parts.length !== 4) {
		return null;
	}

	const [originEnc, redirectEnc, expiresAtRaw, signature] = parts;
	const body = `${originEnc}~${redirectEnc}~${expiresAtRaw}`;
	const expected = String($security.sha256(`${body}|${stateSecret()}`) || '').toLowerCase();
	if (!signature || signature !== expected) {
		return null;
	}

	const expiresAt = Number(expiresAtRaw);
	if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
		return null;
	}

	let origin;
	let redirect;
	try {
		origin = decodeURIComponent(originEnc);
		redirect = decodeURIComponent(redirectEnc);
	} catch {
		return null;
	}

	if (!isAllowedLandingOrigin(origin)) {
		return null;
	}

	return {
		origin: origin.replace(/\/$/, ''),
		redirect: safeRedirectPath(redirect)
	};
}

function buildSteamRedirectUrl(returnTo, realm) {
	const params = [
		['openid.ns', 'http://specs.openid.net/auth/2.0'],
		['openid.mode', 'checkid_setup'],
		['openid.return_to', returnTo],
		['openid.realm', realm],
		['openid.identity', 'http://specs.openid.net/auth/2.0/identifier_select'],
		['openid.claimed_id', 'http://specs.openid.net/auth/2.0/identifier_select']
	];

	return (
		STEAM_OPENID_LOGIN +
		'?' +
		params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')
	);
}

function collectOpenIdParams(e) {
	const params = {};
	const infoQuery = e.requestInfo()?.query || {};
	const keys = Object.keys(infoQuery);
	for (let i = 0; i < keys.length; i++) {
		const key = String(keys[i] || '');
		if (!key.startsWith('openid.')) {
			continue;
		}

		params[key] = String(infoQuery[key] || '');
	}

	if (Object.keys(params).length === 0) {
		const parsed = JSON.parse(toString(e.request.url.query()) || '{}') || {};
		const parsedKeys = Object.keys(parsed);
		for (let i = 0; i < parsedKeys.length; i++) {
			const key = String(parsedKeys[i] || '');
			if (!key.startsWith('openid.')) {
				continue;
			}

			const value = parsed[key];
			params[key] = Array.isArray(value) ? String(value[0] || '') : String(value || '');
		}
	}

	return params;
}

function verifySteamOpenId(e) {
	const params = collectOpenIdParams(e);
	if (!params['openid.claimed_id'] || !params['openid.sig']) {
		throw new BadRequestError('Invalid Steam login response.');
	}

	params['openid.mode'] = 'check_authentication';

	const body = Object.keys(params)
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
		.join('&');

	const response = $http.send({
		url: STEAM_OPENID_LOGIN,
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
		timeout: 20
	});

	const raw = String(response?.raw || '');
	if (!raw.includes('is_valid:true')) {
		throw new BadRequestError('Steam login could not be verified.');
	}

	const claimedId = String(params['openid.claimed_id'] || '');
	if (!claimedId.startsWith(CLAIMED_ID_PREFIX)) {
		throw new BadRequestError('Invalid Steam identity.');
	}

	const steamId = claimedId.slice(CLAIMED_ID_PREFIX.length).replace(/\/$/, '');
	if (!STEAM_ID_REGEX.test(steamId)) {
		throw new BadRequestError('Invalid Steam identity.');
	}

	return steamId;
}

function findUserBySteamId(steamId) {
	try {
		const rows = arrayOf(new DynamicModel({ id: '' }));
		$app
			.db()
			.newQuery(
				`SELECT u.id AS id
				 FROM users u, json_each(
					 CASE WHEN json_valid(u.steamIds) THEN u.steamIds ELSE '[]' END
				 ) AS s
				 WHERE CAST(s.value AS TEXT) = {:sid}
				 LIMIT 1`
			)
			.bind({ sid: steamId })
			.all(rows);

		if (!rows.length || !rows[0].id) {
			return null;
		}

		return $app.findRecordById('users', rows[0].id);
	} catch (error) {
		console.warn('[auth_steam] findUserBySteamId failed', String(error?.message || error));
		return null;
	}
}

function fetchSteamProfile(steamId) {
	const apiKey = $os.getenv('STEAM_API_KEY') || $os.getenv('PUBLIC_STEAM_API_KEY');
	if (!apiKey) {
		return null;
	}

	try {
		const url =
			'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?' +
			`key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}`;
		const response = $http.send({
			url,
			method: 'GET',
			timeout: 15
		});
		const data = response?.json != null ? response.json : JSON.parse(response?.raw || '{}');
		const player = data?.response?.players?.[0];
		if (!player) {
			return null;
		}

		return {
			name: typeof player.personaname === 'string' ? player.personaname : ''
		};
	} catch (error) {
		console.warn('[auth_steam] GetPlayerSummaries failed', String(error?.message || error));
		return null;
	}
}

function randomPassword() {
	return $security.randomString(32);
}

function randomEmail() {
	return `${$security.randomString(24).toLowerCase()}@fknoobs.com`;
}

function createUserForSteam(steamId) {
	const collection = $app.findCollectionByNameOrId('users');
	const record = new Record(collection);
	const password = randomPassword();
	const profile = fetchSteamProfile(steamId);

	record.set('email', randomEmail());
	record.set('emailVisibility', false);
	record.set('verified', true);
	record.set('steamIds', [steamId]);
	if (profile?.name) {
		record.set('name', profile.name.slice(0, 255));
	}

	record.setPassword(password);
	record.set('passwordConfirm', password);
	$app.save(record);
	return record;
}

function findOrCreateUser(steamId) {
	const existing = findUserBySteamId(steamId);
	if (existing) {
		return existing;
	}

	return createUserForSteam(steamId);
}

function landingErrorRedirect(origin, message) {
	const base = origin || ALLOWED_LANDING_ORIGINS[0];
	return `${base}/login?error=${encodeURIComponent(message)}`;
}

function handleStart(e) {
	const query = e.request.url.query();
	const originRaw = String(query.get('origin') || ALLOWED_LANDING_ORIGINS[0]).replace(/\/$/, '');
	if (!isAllowedLandingOrigin(originRaw)) {
		throw new BadRequestError('Invalid origin.');
	}

	const redirect = safeRedirectPath(query.get('redirect'));
	const state = createState(originRaw, redirect);
	const apiBase = apiPublicBase(e);
	const callbackUrl = `${apiBase}/api/auth/steam/callback`;
	const returnTo = `${callbackUrl}?state=${encodeURIComponent(state)}`;
	return e.redirect(302, buildSteamRedirectUrl(returnTo, `${apiBase}/`));
}

function handleCallback(e) {
	const query = e.request.url.query();
	const state = parseState(query.get('state'));
	const origin = state?.origin || ALLOWED_LANDING_ORIGINS[0];

	try {
		if (!state) {
			return e.redirect(302, landingErrorRedirect(origin, 'Invalid or expired Steam login.'));
		}

		const steamId = verifySteamOpenId(e);
		const user = findOrCreateUser(steamId);
		const code = createHandoff(String(user.id));
		const redirect = state.redirect || '/';
		let target = `${origin}/auth/steam?code=${encodeURIComponent(code)}`;
		if (redirect && redirect !== '/') {
			target += `&redirect=${encodeURIComponent(redirect)}`;
		}

		return e.redirect(302, target);
	} catch (error) {
		const message =
			error?.message && typeof error.message === 'string'
				? error.message
				: 'Steam login failed. Please try again.';
		console.warn('[auth_steam] callback failed', String(error?.message || error));
		return e.redirect(302, landingErrorRedirect(origin, message));
	}
}

module.exports = {
	handleStart,
	handleCallback
};
