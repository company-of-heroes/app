import { errAsync, type ResultAsync } from 'neverthrow';
import { z } from 'zod';
import { sendV1, siteUrl, v1Base, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fetchJson } from '../fetch-json';
import { fromPbPromise, requireAuth } from '../pb';

const liveSchema = z.object({ steamIds: z.array(z.string()).optional() });

export type StreamingProgress = {
	streamedMs: number;
	thresholdMs: number;
	badgeGranted: boolean;
};

export type StreamingReport = {
	deltaMs: number;
	twitchLogin?: string | null;
	youtubeChannelId?: string | null;
};

export type YoutubeTokenBundle = {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
};

/** Lifetime streaming time toward the automatic Streamer label + YouTube OAuth helpers. */
export class StreamingApi {
	constructor(private deps: ApiDeps) {}

	getProgress(): ResultAsync<StreamingProgress, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return fromPbPromise(
			sendV1<StreamingProgress>(this.deps, '/streaming/progress'),
			'Failed to load streaming progress.'
		);
	}

	/** Steam ids of players streaming Company of Heroes right now (public). */
	listLiveSteamIds(): ResultAsync<string[], ApiError> {
		return fetchJson(this.deps.fetch, `${v1Base(this.deps)}/streaming/live`, {
			fallback: 'Failed to load live streamers.',
			schema: liveSchema
		}).map((data) => data.steamIds ?? []);
	}

	/** `creditedMs` is how much of `deltaMs` the server counted. */
	report(
		input: StreamingReport
	): ResultAsync<StreamingProgress & { creditedMs: number }, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return fromPbPromise(
			sendV1<StreamingProgress & { creditedMs: number }>(this.deps, '/streaming/progress', {
				method: 'POST',
				body: { ...input, deltaMs: Math.max(0, Math.round(input.deltaMs)) }
			}),
			'Failed to report streaming time.'
		);
	}

	/**
	 * Opens the website → Google consent flow. `redirectUri` must be the desktop
	 * loopback listener (http://localhost|127.0.0.1:8001–8005/).
	 */
	youtubeStartUrl(redirectUri: string, state: string): string {
		const url = new URL(`${siteUrl(this.deps)}/api/v1/streaming/youtube/start`);
		url.searchParams.set('redirect_uri', redirectUri);
		url.searchParams.set('state', state);
		return url.toString();
	}

	/** Swap a short-lived website handoff code for Google tokens. */
	redeemYoutube(code: string): ResultAsync<YoutubeTokenBundle, ApiError> {
		if (!code.trim()) {
			return errAsync(apiError(400, 'Missing YouTube handoff code.'));
		}

		return fromPbPromise(
			sendV1<YoutubeTokenBundle>(this.deps, '/streaming/youtube/redeem', {
				method: 'POST',
				body: { code }
			}),
			'Failed to redeem YouTube tokens.'
		);
	}

	/** Refresh a YouTube access token via the website (client secret stays server-side). */
	refreshYoutube(refreshToken: string): ResultAsync<YoutubeTokenBundle, ApiError> {
		if (!refreshToken.trim()) {
			return errAsync(apiError(400, 'Missing YouTube refresh token.'));
		}

		return fromPbPromise(
			sendV1<YoutubeTokenBundle>(this.deps, '/streaming/youtube/token', {
				method: 'POST',
				body: { refresh_token: refreshToken }
			}),
			'Failed to refresh YouTube token.'
		);
	}
}
