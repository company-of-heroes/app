import type PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { RelicClient } from '../clients/relic';
import { SteamClient } from '../clients/steam';
import { createAdminPocketBase } from '../pb';
import { AuthService } from './auth';
import { CompatService } from './compat';
import { DevSeedService } from './dev-seed';
import { HiddenMatchesService } from './hidden-matches';
import { LeaderboardService } from './leaderboard';
import { LiveLobbiesService } from './live-lobbies';
import { LobbiesService } from './lobbies';
import { LobbyCompatService } from './lobby-compat';
import { MatchHistoryService } from './match-history';
import { MatchResultsService } from './match-results';
import { MatchesService } from './matches';
import { MemberReplaysService } from './member-replays';
import { OverlaysService, type OverlayBucket } from './overlays';
import { PerformanceService } from './performance';
import { PlayerInfoService } from './player-info';
import { PlayerPageService } from './player-page';
import { PlayerSocialService } from './player-social';
import { PlayersService } from './players';
import { RatingHarvestService } from './rating-harvest';
import { RatingsService } from './ratings';
import { RelationsService } from './relations';
import { ReplaysService } from './replays';
import { ReputationService } from './reputation';
import { RewardsService } from './rewards';
import { SmurfService } from './smurf';
import { SocialService } from './social';
import { SocialCompatService } from './social-compat';
import { StreamingService } from './streaming';
import { TwitchService } from './twitch';
import { UsersService } from './users';
import { YoutubeOauthService } from './youtube-oauth';

type Fetch = typeof globalThis.fetch;

/** Shared clients of one request, each built on first use. */
export class Clients {
	#pb?: PocketBase;
	#relic?: RelicClient;
	#steam?: SteamClient;

	constructor(
		readonly fetch: Fetch,
		readonly overlays: OverlayBucket | undefined
	) {}

	/** Superuser PocketBase client. */
	get pb(): PocketBase {
		return (this.#pb ??= createAdminPocketBase(this.fetch));
	}

	get relic(): RelicClient {
		return (this.#relic ??= new RelicClient(this.fetch));
	}

	get steam(): SteamClient {
		return (this.#steam ??= new SteamClient(this.fetch, env.STEAM_API_KEY ?? ''));
	}

	/** For PocketBase files: the api-gateway lets the website's own fetches past its per-IP download limit. */
	readonly fileFetch: Fetch = (input, init) =>
		this.fetch(input, {
			...init,
			headers: {
				...Object.fromEntries(new Headers(init?.headers)),
				'x-replay-proxy': env.REPLAY_PROXY_SECRET ?? ''
			}
		});
}

/**
 * All server services for one request (`locals.services`). Each is built on first
 * use and gets the request's `locals`; services reach each other through it.
 */
export class Services {
	readonly clients: Clients;
	readonly #instances = new Map<string, unknown>();

	constructor(
		private readonly locals: App.Locals,
		options: { fetch: Fetch; overlays?: OverlayBucket }
	) {
		this.clients = new Clients(options.fetch, options.overlays);
	}

	#get<T>(name: string, Build: new (locals: App.Locals) => T): T {
		let instance = this.#instances.get(name) as T | undefined;
		if (!instance) {
			instance = new Build(this.locals);
			this.#instances.set(name, instance);
		}

		return instance;
	}

	get auth() {
		return this.#get('auth', AuthService);
	}

	get compat() {
		return this.#get('compat', CompatService);
	}

	get devSeed() {
		return this.#get('devSeed', DevSeedService);
	}

	get hiddenMatches() {
		return this.#get('hiddenMatches', HiddenMatchesService);
	}

	get leaderboard() {
		return this.#get('leaderboard', LeaderboardService);
	}

	get liveLobbies() {
		return this.#get('liveLobbies', LiveLobbiesService);
	}

	get lobbies() {
		return this.#get('lobbies', LobbiesService);
	}

	get lobbyCompat() {
		return this.#get('lobbyCompat', LobbyCompatService);
	}

	get matchHistory() {
		return this.#get('matchHistory', MatchHistoryService);
	}

	get matchResults() {
		return this.#get('matchResults', MatchResultsService);
	}

	get matches() {
		return this.#get('matches', MatchesService);
	}

	get memberReplays() {
		return this.#get('memberReplays', MemberReplaysService);
	}

	get overlays() {
		return this.#get('overlays', OverlaysService);
	}

	get performance() {
		return this.#get('performance', PerformanceService);
	}

	get playerInfo() {
		return this.#get('playerInfo', PlayerInfoService);
	}

	get playerPage() {
		return this.#get('playerPage', PlayerPageService);
	}

	get playerSocial() {
		return this.#get('playerSocial', PlayerSocialService);
	}

	get players() {
		return this.#get('players', PlayersService);
	}

	get ratingHarvest() {
		return this.#get('ratingHarvest', RatingHarvestService);
	}

	get ratings() {
		return this.#get('ratings', RatingsService);
	}

	get relations() {
		return this.#get('relations', RelationsService);
	}

	get replays() {
		return this.#get('replays', ReplaysService);
	}

	get reputation() {
		return this.#get('reputation', ReputationService);
	}

	get rewards() {
		return this.#get('rewards', RewardsService);
	}

	get smurf() {
		return this.#get('smurf', SmurfService);
	}

	get social() {
		return this.#get('social', SocialService);
	}

	get socialCompat() {
		return this.#get('socialCompat', SocialCompatService);
	}

	get streaming() {
		return this.#get('streaming', StreamingService);
	}

	get twitch() {
		return this.#get('twitch', TwitchService);
	}

	get users() {
		return this.#get('users', UsersService);
	}

	get youtubeOauth() {
		return this.#get('youtubeOauth', YoutubeOauthService);
	}
}
