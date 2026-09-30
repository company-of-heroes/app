import { env } from '$env/dynamic/private';
import { err, errAsync, ok } from 'neverthrow';
import { cached } from '../cache';
import { upstream } from '../errors';
import { fetchJson, type Task } from '../result';
import { Service } from './service';

export type LiveStream = {
	id: string;
	userName: string;
	userDisplayName: string;
	title: string;
	gameName: string;
	viewers: number;
	thumbnailUrl: string;
};

/** Twitch categories for CoH1 and its expansions (ids are stable; names are the check). */
const COH1_GAMES: Record<string, string> = {
	'17343': 'Company of Heroes',
	'4359': 'Company of Heroes: Opposing Fronts',
	'22080': 'Company of Heroes: Tales of Valor',
	'789122137': 'Company of Heroes: Definitive Edition'
};
/** Public Twitch app id of the CoH1 stats app; the secret comes from the environment. */
const TWITCH_CLIENT_ID = 'kp4erttmb696osn4inqrlg6qmv5eaq';
const COH1_NAMES = new Set(Object.values(COH1_GAMES).map((name) => name.toLowerCase()));

type HelixStream = {
	id: string;
	user_login: string;
	user_name: string;
	title: string;
	game_name: string;
	viewer_count: number;
	thumbnail_url: string;
};

export class TwitchService extends Service {
	private readonly clientId = env.TWITCH_CLIENT_ID || TWITCH_CLIENT_ID;
	private readonly clientSecret = env.TWITCH_CLIENT_SECRET ?? '';

	private appToken(): Task<string> {
		if (!this.clientSecret) {
			return errAsync(upstream('Twitch streams are not configured'));
		}

		// App tokens live ~60 days; refresh daily.
		return cached('twitch:app-token', 86_400, () =>
			fetchJson<{ access_token?: string }>(
				this.fetch,
				'https://id.twitch.tv/oauth2/token',
				{
					method: 'POST',
					headers: { 'content-type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						client_id: this.clientId,
						client_secret: this.clientSecret,
						grant_type: 'client_credentials'
					})
				},
				'Twitch token'
			).andThen(({ access_token }) =>
				access_token
					? ok(access_token)
					: err(upstream('Twitch token response missing access_token'))
			)
		);
	}

	/** Live CoH1 streams, most viewers first. */
	listStreams(): Task<LiveStream[]> {
		const params = new URLSearchParams({ first: '100' });
		for (const gameId of Object.keys(COH1_GAMES)) {
			params.append('game_id', gameId);
		}
		return cached('twitch:streams', 60, () =>
			this.appToken()
				.andThen((token) =>
					fetchJson<{ data?: HelixStream[] }>(
						this.fetch,
						`https://api.twitch.tv/helix/streams?${params}`,
						{ headers: { 'client-id': this.clientId, authorization: `Bearer ${token}` } },
						'Twitch streams'
					)
				)
				.map(({ data }) =>
					(data ?? [])
						.filter(
							(stream) =>
								stream.id &&
								stream.user_login &&
								COH1_NAMES.has(stream.game_name.trim().toLowerCase())
						)
						.map((stream) => ({
							id: stream.id,
							userName: stream.user_login,
							userDisplayName: stream.user_name,
							title: stream.title,
							gameName: stream.game_name,
							viewers: stream.viewer_count,
							thumbnailUrl: stream.thumbnail_url
								.replace('{width}', '440')
								.replace('{height}', '248')
						}))
						.sort((a, b) => b.viewers - a.viewers)
				)
		);
	}
}
