import { env } from '$env/dynamic/private';
import { err, ok, okAsync, type Result } from 'neverthrow';
import { badRequest, upstream, type AppError } from '../errors';
import { ensure, fetchJson, fromAsync, type Task } from '../result';
import {
	YOUTUBE_AUTH_URL,
	YOUTUBE_SCOPE,
	YOUTUBE_TOKEN_URL,
	createOauthState,
	createPkce,
	createTokenHandoff,
	isAllowedAppRedirect,
	readOauthState,
	readTokenHandoff,
	type YoutubeTokenBundle
} from '../domain/youtube-oauth';
import { Service } from './service';

function callbackUrl(origin: string): string {
	return `${origin.replace(/\/$/, '')}/api/v1/streaming/youtube/callback`;
}

/**
 * Google OAuth for the desktop Streaming → YouTube connect flow.
 * The client secret stays on the website; the app only ever sees short-lived
 * handoff codes and the resulting user tokens.
 */
export class YoutubeOauthService extends Service {
	private readonly clientId = env.YOUTUBE_CLIENT_ID ?? '';
	private readonly clientSecret = env.YOUTUBE_CLIENT_SECRET ?? '';
	/** Signs the OAuth state and handoff codes: without it anyone could forge one, so there is no default. */
	private readonly handoffSecret = env.AUTH_HANDOFF_SECRET ?? '';

	private requireConfig(): Result<void, AppError> {
		if (!this.clientId || !this.clientSecret || !this.handoffSecret) {
			return err(upstream('YouTube sign-in is not configured'));
		}

		return ok(undefined);
	}

	private exchange(body: Record<string, string>): Task<YoutubeTokenBundle> {
		return fetchJson<Partial<YoutubeTokenBundle>>(
			this.fetch,
			YOUTUBE_TOKEN_URL,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					client_id: this.clientId,
					client_secret: this.clientSecret,
					...body
				}).toString()
			},
			'YouTube token exchange'
		).andThen((data) =>
			data.access_token && typeof data.expires_in === 'number'
				? ok({
						access_token: data.access_token,
						expires_in: data.expires_in,
						refresh_token: data.refresh_token
					})
				: err(upstream('YouTube token response was incomplete'))
		);
	}
	/** Browser: validate loopback redirect, then send the user to Google consent. */
	start(origin: string, redirectUri: string, clientState: string): Task<string> {
		return this.requireConfig()
			.andThen(() =>
				ensure(isAllowedAppRedirect(redirectUri), badRequest('Invalid YouTube redirect URI'))
			)
			.andThen(() =>
				ensure(clientState && clientState.length <= 128, badRequest('Invalid OAuth state'))
			)
			.asyncAndThen(() => fromAsync(createPkce(), 'Could not start sign-in'))
			.andThen(({ verifier, challenge }) =>
				fromAsync(
					createOauthState({ redirectUri, clientState, verifier }, this.handoffSecret),
					'Could not start sign-in'
				).map((state) => {
					const url = new URL(YOUTUBE_AUTH_URL);
					url.searchParams.set('client_id', this.clientId);
					url.searchParams.set('redirect_uri', callbackUrl(origin));
					url.searchParams.set('response_type', 'code');
					url.searchParams.set('scope', YOUTUBE_SCOPE);
					url.searchParams.set('access_type', 'offline');
					url.searchParams.set('prompt', 'consent');
					url.searchParams.set('code_challenge', challenge);
					url.searchParams.set('code_challenge_method', 'S256');
					url.searchParams.set('state', state);
					return url.toString();
				})
			);
	}

	/** A handoff code for the tokens behind an authorization code; null when the exchange failed. */
	private handoffFor(origin: string, code: string, verifier: string): Task<string | null> {
		return this.exchange({
			grant_type: 'authorization_code',
			code,
			code_verifier: verifier,
			redirect_uri: callbackUrl(origin)
		})
			.andThen((tokens) =>
				fromAsync(createTokenHandoff(tokens, this.handoffSecret), 'Could not finish sign-in')
			)
			.orElse(() => ok(null));
	}

	/**
	 * Google returns here. Exchange the code, then bounce to the desktop loopback
	 * with a short-lived handoff code (or an error flag).
	 */
	callback(origin: string, query: URLSearchParams): Task<{ redirectUri: string }> {
		return this.requireConfig()
			.asyncAndThen(() =>
				fromAsync(
					readOauthState(query.get('state') ?? '', this.handoffSecret),
					'Invalid or expired OAuth state'
				)
			)
			.andThen((state) => (state ? ok(state) : err(badRequest('Invalid or expired OAuth state'))))
			.andThen((state) => {
				const target = new URL(state.redirectUri);
				target.searchParams.set('state', state.clientState);
				const done = () => ({ redirectUri: target.toString() });
				const oauthError = query.get('error');
				if (oauthError) {
					target.searchParams.set('error', oauthError);
					return okAsync(done());
				}

				const code = query.get('code');
				if (!code) {
					target.searchParams.set('error', 'missing_code');
					return okAsync(done());
				}

				return this.handoffFor(origin, code, state.verifier).map((handoff) => {
					if (handoff) {
						target.searchParams.set('code', handoff);
					} else {
						target.searchParams.set('error', 'token_exchange_failed');
					}

					return done();
				});
			});
	}

	/** Desktop: turn a handoff code into Google tokens. */
	redeem(code: string): Task<YoutubeTokenBundle> {
		return this.requireConfig()
			.asyncAndThen(() =>
				fromAsync(
					readTokenHandoff(code, this.handoffSecret),
					'Invalid or expired YouTube handoff code'
				)
			)
			.andThen((tokens) =>
				tokens ? ok(tokens) : err(badRequest('Invalid or expired YouTube handoff code'))
			);
	}

	/** Desktop: refresh an access token; the refresh token never needs the client secret in the app. */
	refresh(refreshToken: string): Task<YoutubeTokenBundle> {
		return this.requireConfig()
			.andThen(() => ensure(refreshToken, badRequest('Missing refresh token')))
			.asyncAndThen(() =>
				this.exchange({ grant_type: 'refresh_token', refresh_token: refreshToken })
			);
	}
}
