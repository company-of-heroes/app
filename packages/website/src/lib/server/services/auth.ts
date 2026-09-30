import type { RecordModel } from 'pocketbase';
import { env } from '$env/dynamic/private';
import { err, errAsync, ok, okAsync, type Result } from 'neverthrow';
import { API_URL } from '$lib/site/urls';
import { badRequest, forbidden, internal, notFound, type AppError } from '../errors';
import { ensure, fromAsync, fromPb, type Task } from '../result';
import { Service } from './service';
import {
	STEAM_OPENID_LOGIN,
	createHandoffCode,
	createSteamState,
	openIdParams,
	readHandoffCode,
	readSteamState,
	returnsTo,
	safeRedirectPath,
	steamIdFromClaim,
	steamLoginUrl
} from '../domain/auth';

/** Sites a Steam login may return to. */
const SITE_ORIGINS = [
	'https://coh1stats.com',
	'https://www.coh1stats.com',
	'http://localhost:5174',
	'http://127.0.0.1:5174'
];
/** Where Steam sends users back: the website, and PocketBase's old route (logins already under way). */
const CALLBACK_PATH = '/api/v1/auth/steam/callback';
const LEGACY_CALLBACK_PATH = '/api/auth/steam/callback';
export type AuthSession = { token: string; record: RecordModel };

function randomString(length: number): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	return [...crypto.getRandomValues(new Uint8Array(length))]
		.map((byte) => alphabet[byte % alphabet.length])
		.join('');
}

/**
 * Signing in without a password: Steam OpenID, handoff codes (desktop app → browser)
 * and staff impersonation. PocketBase only issues the (refreshable) session, via its
 * service-token route `/api/_auth/token`.
 */
export class AuthService extends Service {
	/** Signs login codes: without it anyone could forge one, so there is no default. */
	private secrets(): Result<{ serviceToken: string; handoffSecret: string }, AppError> {
		if (!env.AUTH_HANDOFF_SECRET || !env.SERVICE_TOKEN) {
			console.error('[auth] AUTH_HANDOFF_SECRET and SERVICE_TOKEN must be configured');
			return err(internal());
		}

		return ok({ serviceToken: env.SERVICE_TOKEN, handoffSecret: env.AUTH_HANDOFF_SECRET });
	}

	/** A regular PocketBase session for the user (what password login would return). */
	session(userId: string): Task<AuthSession> {
		return this.secrets().asyncAndThen(({ serviceToken }) =>
			fromPb(
				this.pb.send<AuthSession>('/api/_auth/token', {
					method: 'POST',
					body: { userId },
					headers: { Authorization: `Bearer ${serviceToken}` }
				}),
				'User not found'
			)
		);
	}

	createHandoff(userId: string): Task<string> {
		return this.secrets().asyncAndThen(({ handoffSecret }) =>
			fromAsync(createHandoffCode(userId, handoffSecret), 'Could not create a login code')
		);
	}

	/** Trades a handoff code for a session (a code may be used again within its five minutes). */
	exchangeHandoff(code: string): Task<AuthSession> {
		const invalid = () => badRequest('Invalid or expired login code.');
		return this.secrets()
			.asyncAndThen(({ handoffSecret }) =>
				fromAsync(readHandoffCode(code, handoffSecret), 'Invalid or expired login code.', 400)
			)
			.andThen((userId) => (userId ? ok(userId) : err(invalid())))
			.andThen((userId) => this.session(userId).mapErr(invalid));
	}

	/** Staff sign in as another user (the app keeps the admin's own login to switch back). */
	impersonate(admin: { id: string; role?: string }, userId: string): Task<AuthSession> {
		if (admin.role !== 'admin') {
			return errAsync(forbidden('Only admins can impersonate users'));
		}

		if (!userId) {
			return errAsync(badRequest('User id required'));
		}

		if (userId === admin.id) {
			return errAsync(badRequest('You are already signed in as this user'));
		}

		console.info('[auth] impersonate', admin.id, '->', userId);
		return this.session(userId).mapErr((error) =>
			error.status === 500 ? error : notFound('User not found')
		);
	}

	/** Where to send the browser to log in with Steam. */
	steamStart(siteOrigin: string, requestedOrigin: string | null, redirect: unknown): Task<string> {
		const origin = (requestedOrigin ?? siteOrigin).replace(/\/$/, '');
		return this.secrets()
			.andThen((secrets) =>
				ensure(
					SITE_ORIGINS.includes(origin) || origin === siteOrigin,
					badRequest('Invalid origin.')
				).map(() => secrets)
			)
			.asyncAndThen(({ handoffSecret }) =>
				fromAsync(
					createSteamState(origin, safeRedirectPath(redirect), handoffSecret),
					'Could not start Steam login'
				)
			)
			.map((state) =>
				steamLoginUrl(
					`${siteOrigin}${CALLBACK_PATH}?state=${encodeURIComponent(state)}`,
					`${siteOrigin}/`
				)
			);
	}

	/** Asks Steam whether the login response is genuine; returns the Steam id. */
	private verifyWithSteam(query: URLSearchParams, siteOrigin: string): Task<string> {
		const params = openIdParams(query);
		const invalid = badRequest('Invalid Steam login response.');
		return ensure(params['openid.claimed_id'] && params['openid.sig'], invalid)
			.andThen(() =>
				ensure(
					returnsTo(params['openid.return_to'] ?? '', [
						`${siteOrigin}${CALLBACK_PATH}`,
						`${API_URL}${LEGACY_CALLBACK_PATH}`
					]),
					invalid
				)
			)
			.asyncAndThen(() =>
				fromAsync(
					this.fetch(STEAM_OPENID_LOGIN, {
						method: 'POST',
						headers: { 'content-type': 'application/x-www-form-urlencoded' },
						body: new URLSearchParams({ ...params, 'openid.mode': 'check_authentication' })
					}).then((response) => response.text()),
					'Steam login could not be verified.',
					502
				)
			)
			.andThen((text) =>
				ensure(text.includes('is_valid:true'), badRequest('Steam login could not be verified.'))
			)
			.andThen(() => {
				const steamId = steamIdFromClaim(params['openid.claimed_id']);
				return steamId ? ok(steamId) : err(badRequest('Invalid Steam identity.'));
			});
	}

	/** A new account for a Steam id (random email and password), named after the Steam profile. */
	private createSteamUser(steamId: string): Task<string> {
		return this.steam
			.playerSummaries([steamId])
			.andThen((summaries) => {
				const name = summaries.get(steamId)?.personaname ?? '';
				const password = randomString(32);
				return fromPb(
					this.pb.collection('users').create<{ id: string }>({
						email: `${randomString(24)}@fknoobs.com`,
						emailVisibility: false,
						verified: true,
						steamIds: [steamId],
						password,
						passwordConfirm: password,
						...(name ? { name: String(name).slice(0, 255) } : {})
					}),
					'Could not create the account'
				);
			})
			.map((created) => created.id);
	}

	/** The account for a Steam id; a new one the first time. */
	private userForSteam(steamId: string): Task<string> {
		return fromPb(
			this.pb.collection('users').getList<{ id: string }>(1, 1, {
				filter: this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` }),
				fields: 'id',
				skipTotal: true
			}),
			'Could not load users'
		).andThen((existing) =>
			existing.items[0] ? okAsync(existing.items[0].id) : this.createSteamUser(steamId)
		);
	}

	/**
	 * Steam sent the user back: verify, find or create the account, and continue on
	 * the site with a handoff code (the site sets its cookie when it redeems the code).
	 * Returns the absolute URL to redirect to; failures redirect to the login page.
	 */
	steamCallback(query: URLSearchParams, siteOrigin: string): Task<string> {
		return this.secrets()
			.asyncAndThen(({ handoffSecret }) =>
				fromAsync(
					readSteamState(query.get('state') ?? '', handoffSecret, [...SITE_ORIGINS, siteOrigin]),
					'Invalid or expired Steam login.'
				).orElse(() => ok(null))
			)
			.andThen((state) => {
				const origin = state?.origin ?? siteOrigin;
				const failed = (message: string) => `${origin}/login?error=${encodeURIComponent(message)}`;
				if (!state) {
					return okAsync(failed('Invalid or expired Steam login.'));
				}

				return this.verifyWithSteam(query, siteOrigin)
					.andThen((steamId) => this.userForSteam(steamId))
					.andThen((userId) => this.createHandoff(userId))
					.map((code) => {
						const url = new URL(`${origin}/auth/steam`);
						url.searchParams.set('code', code);
						if (state.redirect !== '/') {
							url.searchParams.set('redirect', state.redirect);
						}

						return url.toString();
					})
					.orElse((error) => {
						console.warn('[auth] steam callback failed', error);
						return ok(
							failed(error.status === 400 ? error.message : 'Steam login failed. Please try again.')
						);
					});
			});
	}
}
