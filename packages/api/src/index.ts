export { createApi, type Api } from './client';
export { type ApiDeps, normalizeBaseUrl, resolveAuthHeaders } from './deps';
export { apiError, fromUnknown, isApiError, type ApiError } from './errors';
export { unwrapApi } from './unwrap';

export {
	LiveLobbiesApi,
	LOBBIES_LIVE_STALE_MS,
	LOBBIES_LIVE_HEARTBEAT_MS,
	lobbiesLiveFreshFilter,
	lobbiesLivePublicFilter,
	isLiveLobbyFresh,
	isPublicLiveLobby,
	type LiveLobbyRecord,
	type LiveLobbyWriteInput,
	type LiveLobbyWritePlayer,
	type LiveLobbyRow
} from './live-lobbies';

export {
	MatchSocialApi,
	type CommentAuthor,
	type LobbyComment,
	type MentionUser,
	type ReplayComment
} from './match-social';

export { PlayerSocialApi } from './player-social';

export {
	HiddenMatchesApi,
	titleMatchesHiddenKeyword,
	relicLobbyDescription,
	isHiddenFromPublic,
	invalidateHiddenKeywordCache,
	type HiddenMatch,
	type HiddenMatchKeyword
} from './hidden-matches';

export {
	AuthApi,
	canRequestEmailChange,
	isPlaceholderEmail,
	PLACEHOLDER_EMAIL_DOMAIN,
	type AuthExchange,
	type AuthUser,
	type CompanionUserDebug,
	type UserRole
} from './auth';

export {
	PlayersApi,
	type PlayerPageData,
	type PlayerSearchOptions,
	type PlayerSearchResult
} from './players';

export {
	LeaderboardsApi,
	type LeaderboardPageData,
	type LeaderboardStatWithProfile,
	type RelicLeaderboardProfile
} from './leaderboards';

export { TwitchApi, type LiveStream } from './twitch';

export {
	ReplaysApi,
	REPLAYS_PER_PAGE,
	HISTORY_MATCHUP_TYPES,
	matchtypesForMatchups,
	slotsForPositions,
	buildMatchHistoryUrl,
	buildMemberReplaysUrl,
	matchFileUrl,
	type CommunityMatch,
	type CommunityMatchDetail,
	type CommunityMatchList,
	type CommunityPlayer,
	type MatchHistoryScopeOptions,
	type MatchResult,
	type MemberReplayDetail,
	type MemberReplayStatsPreview,
	type MemberReplayList,
	type MemberReplayUploadInput,
	type MemberReplayUpdateInput,
	type MemberReplayUploader,
	type MemberReplayRosterPlayer,
	memberReplayRosterForEdit,
	type PublishFromMatchInput,
	type ReplaysQuery,
	type HistoryMapOption
} from './replays';

export {
	MatchesApi,
	type AggregationPlayer,
	type AttachReplayResult,
	type FilterOperator,
	type HistoryListQuery,
	type HistorySortField,
	type MatchAggregation,
	type MatchCreateInput,
	type MatchRecord,
	type MatchUpdateInput
} from './matches';

export {
	NotificationsApi,
	type NotificationCreateInput,
	type NotificationReadRecord,
	type NotificationRecord
} from './notifications';

export {
	RatingsApi,
	LEADERBOARD_ELO_STALE_MS,
	LEADERBOARD_HARVEST_MAX,
	INGEST_BATCH_SIZE,
	isStoredMatchType,
	isValidSteamId,
	eloMapFromRecord,
	eloMapFromSlots,
	extractPlayerRatingSnapshots,
	selectLeaderboardHarvestProfileIds,
	groupEloHistoryByModeAndRace,
	type PlayerEloHistoryPoint,
	type PlayerEloMap,
	type PlayerRatingRecord,
	type PlayerRatingSnapshot
} from './ratings';

export {
	LabelsApi,
	DEFAULT_LABEL_HEX,
	labelColorSwatches,
	labelHex,
	sortUserLabels,
	labelsBySteamId,
	type UserLabel,
	type PlayerLabelAssignment
} from './labels';

export {
	AntiCheatApi,
	type AntiCheatReport,
	type CaptureRecord,
	type CaptureSessionHint,
	type CheaterRecord
} from './anti-cheat';

export {
	SmurfWatchApi,
	type SmurfWatchRecord,
	type SmurfWatchSource,
	type SmurfWatchStatus
} from './smurf-watch';

export {
	ReputationApi,
	REPUTATION_TRIGGER_CATALOG,
	type ReputationTrigger,
	type ReputationTriggerCatalogItem,
	type ReputationType
} from './reputation';

export {
	PlayerPerformanceApi,
	emptyPlayerPerformance,
	invalidatePlayerPerformanceCache,
	type PerformanceScope,
	type PlayerPerformance
} from './player-performance';

export { CompanionApi, readMetaVersion, type CompanionUser } from './companion';
