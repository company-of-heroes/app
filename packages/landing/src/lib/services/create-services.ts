import type PocketBase from 'pocketbase';
import {
	createApi,
	type Api,
	type AuthApi,
	type HiddenMatchesApi,
	type LeaderboardsApi,
	type LiveLobbiesApi,
	type MatchSocialApi,
	type PlayerCompareApi,
	type PlayerSocialApi,
	type PlayersApi,
	type RatingsApi,
	type TwitchApi
} from '@company-of-heroes/api';
import { API_URL } from '$lib/site/urls';
import { LandingReplaysService } from './replays-host';

export type ServiceDeps = {
	pocketbase: PocketBase;
	fetch: typeof fetch;
};

export type Services = {
	auth: () => AuthApi;
	hiddenMatches: () => HiddenMatchesApi;
	leaderboards: () => LeaderboardsApi;
	liveLobbies: () => LiveLobbiesApi;
	matchSocial: () => MatchSocialApi;
	playerCompare: () => PlayerCompareApi;
	playerSocial: () => PlayerSocialApi;
	players: () => PlayersApi;
	ratings: () => RatingsApi;
	replays: () => LandingReplaysService;
	twitch: () => TwitchApi;
};

export function createServices(deps: ServiceDeps): Services {
	let api: Api | undefined;
	const getApi = () =>
		(api ??= createApi({
			pocketbase: deps.pocketbase,
			fetch: deps.fetch,
			baseUrl: API_URL
		}));

	let replays: LandingReplaysService | undefined;

	return {
		auth: () => getApi().auth,
		hiddenMatches: () => getApi().hiddenMatches,
		leaderboards: () => getApi().leaderboards,
		liveLobbies: () => getApi().liveLobbies,
		matchSocial: () => getApi().matchSocial,
		playerCompare: () => getApi().playerCompare,
		playerSocial: () => getApi().playerSocial,
		players: () => getApi().players,
		ratings: () => getApi().ratings,
		replays: () =>
			(replays ??= new LandingReplaysService(getApi().replays, deps.fetch, API_URL)),
		twitch: () => getApi().twitch
	};
}
