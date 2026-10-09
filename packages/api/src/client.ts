import type { ApiDeps } from './deps';
import { AntiCheatApi } from './anti-cheat/anti-cheat';
import { AuthApi } from './auth/auth';
import { CompanionApi } from './companion/companion';
import { HiddenMatchesApi } from './hidden-matches/hidden-matches';
import { LabelsApi } from './labels/labels';
import { LeaderboardsApi } from './leaderboards/leaderboards';
import { LiveLobbiesApi } from './live-lobbies/live-lobbies';
import { MatchSocialApi } from './match-social/match-social';
import { MatchesApi } from './matches/matches';
import { NotificationsApi } from './notifications/notifications';
import { PlayerPerformanceApi } from './player-performance/player-performance';
import { PlayerSocialApi } from './player-social/player-social';
import { PlayersApi } from './players/players';
import { RatingsApi } from './ratings/ratings';
import { ReplaysApi } from './replays/replays';
import { ReputationApi } from './reputation/reputation';
import { RewardsApi } from './rewards/rewards';
import { SmurfWatchApi } from './smurf-watch/smurf-watch';
import { StreamingApi } from './streaming/streaming';
import { TournamentsApi } from './tournaments/tournaments';
import { TwitchApi } from './twitch/twitch';

export type Api = {
	antiCheat: AntiCheatApi;
	auth: AuthApi;
	companion: CompanionApi;
	hiddenMatches: HiddenMatchesApi;
	labels: LabelsApi;
	leaderboards: LeaderboardsApi;
	liveLobbies: LiveLobbiesApi;
	matchSocial: MatchSocialApi;
	matches: MatchesApi;
	notifications: NotificationsApi;
	playerPerformance: PlayerPerformanceApi;
	playerSocial: PlayerSocialApi;
	players: PlayersApi;
	ratings: RatingsApi;
	replays: ReplaysApi;
	reputation: ReputationApi;
	rewards: RewardsApi;
	smurfWatch: SmurfWatchApi;
	streaming: StreamingApi;
	tournaments: TournamentsApi;
	twitch: TwitchApi;
};

export function createApi(deps: ApiDeps): Api {
	return {
		antiCheat: new AntiCheatApi(deps),
		auth: new AuthApi(deps),
		companion: new CompanionApi(deps),
		hiddenMatches: new HiddenMatchesApi(deps),
		labels: new LabelsApi(deps),
		leaderboards: new LeaderboardsApi(deps),
		liveLobbies: new LiveLobbiesApi(deps),
		matchSocial: new MatchSocialApi(deps),
		matches: new MatchesApi(deps),
		notifications: new NotificationsApi(deps),
		playerPerformance: new PlayerPerformanceApi(deps),
		playerSocial: new PlayerSocialApi(deps),
		players: new PlayersApi(deps),
		ratings: new RatingsApi(deps),
		replays: new ReplaysApi(deps),
		reputation: new ReputationApi(deps),
		rewards: new RewardsApi(deps),
		smurfWatch: new SmurfWatchApi(deps),
		streaming: new StreamingApi(deps),
		tournaments: new TournamentsApi(deps),
		twitch: new TwitchApi(deps)
	};
}
