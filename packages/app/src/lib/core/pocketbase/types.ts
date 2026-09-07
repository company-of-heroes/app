/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	AntiCheatCaptures: "anti_cheat_captures",
	AntiCheatCheaters: "anti_cheat_cheaters",
	AntiCheatProcessDenylist: "anti_cheat_process_denylist",
	AntiCheatProcessHits: "anti_cheat_process_hits",
	AntiCheatModuleAllowlist: "anti_cheat_module_allowlist",
	AntiCheatModuleHits: "anti_cheat_module_hits",
	AntiCheatReports: "anti_cheat_reports",
	Attachments: "attachments",
	HiddenMatchKeywords: "hidden_match_keywords",
	HiddenMatches: "hidden_matches",
	JobState: "job_state",
	Lobbies: "lobbies",
	LobbiesLive: "lobbies_live",
	LobbyCommentLikes: "lobby_comment_likes",
	LobbyComments: "lobby_comments",
	LobbyDownloadFingerprints: "lobby_download_fingerprints",
	LobbyDownloads: "lobby_downloads",
	LobbyLikes: "lobby_likes",
	LobbyPlayerIndex: "lobby_player_index",
	Maps: "maps",
	MatchFilterSnapshots: "match_filter_snapshots",
	MemberReplayDownloadFingerprints: "member_replay_download_fingerprints",
	NotificationReads: "notification_reads",
	Notifications: "notifications",
	PlayerLabelAssignments: "player_label_assignments",
	PlayerLikes: "player_likes",
	PlayerRatings: "player_ratings",
	PlayerVoteScores: "player_vote_scores",
	Players: "players",
	ReplayAggregation: "replay_aggregation",
	ReplayCommentLikes: "replay_comment_likes",
	ReplayComments: "replay_comments",
	ReplayLikes: "replay_likes",
	Replays: "replays",
	ReputationTypes: "reputation_types",
	SmurfWatch: "smurf_watch",
	UserLabels: "user_labels",
	UserOverlays: "user_overlays",
	UserReputation: "user_reputation",
	UserReputationTotals: "user_reputation_totals",
	Users: "users",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type AntiCheatCapturesRecord = {
	captured_at?: IsoDateString
	created: IsoAutoDateString
	game_focused?: boolean
	hidden?: boolean
	hiddenAt?: IsoDateString
	hiddenBy?: RecordIdString
	id: string
	image: FileNameString
	map?: string
	session_id?: number
	steam_id?: string
	updated: IsoAutoDateString
	user: RecordIdString
}

export type AntiCheatCheatersRecord = {
	created: IsoAutoDateString
	id: string
	labeled_by?: RecordIdString
	steam_id: string
	updated: IsoAutoDateString
	user: RecordIdString
}

export type AntiCheatProcessDenylistRecord = {
	created: IsoAutoDateString
	enabled?: boolean
	id: string
	label?: string
	name: string
	updated: IsoAutoDateString
}

export type AntiCheatProcessHitsRecord = {
	created: IsoAutoDateString
	detected_at?: IsoDateString
	id: string
	pid?: number
	process_name: string
	session_id?: number
	updated: IsoAutoDateString
	user: RecordIdString
}

export type AntiCheatModuleAllowlistRecord = {
	created: IsoAutoDateString
	enabled?: boolean
	id: string
	label?: string
	name: string
	updated: IsoAutoDateString
}

export type AntiCheatModuleHitsRecord = {
	created: IsoAutoDateString
	detected_at?: IsoDateString
	id: string
	module_name: string
	module_path: string
	pid?: number
	session_id?: number
	updated: IsoAutoDateString
	user: RecordIdString
}

export const AntiCheatReportsStatusOptions = {
	"pending": "pending",
	"dismissed": "dismissed",
	"confirmed": "confirmed",
} as const
export type AntiCheatReportsStatusOptions = typeof AntiCheatReportsStatusOptions[keyof typeof AntiCheatReportsStatusOptions]
export type AntiCheatReportsRecord = {
	accused: RecordIdString
	accused_steam_id?: string
	created: IsoAutoDateString
	id: string
	lobby?: RecordIdString
	note?: string
	reporter: RecordIdString
	session_id: number
	status: AntiCheatReportsStatusOptions
	updated: IsoAutoDateString
}

export type AttachmentsRecord = {
	created: IsoAutoDateString
	file: FileNameString
	id: string
	type: string
	updated: IsoAutoDateString
}

export type HiddenMatchKeywordsRecord = {
	created: IsoAutoDateString
	createdBy?: RecordIdString
	id: string
	updated: IsoAutoDateString
	word: string
}

export type HiddenMatchesRecord = {
	created: IsoAutoDateString
	hiddenBy?: RecordIdString
	id: string
	sessionId: number
	updated: IsoAutoDateString
}

export type JobStateRecord = {
	complete?: boolean
	id: string
	page?: number
	updatedAt: IsoAutoDateString
}

export type LobbiesRecord<TlobbyPlayers = unknown, Tplayers = unknown, Tresult = unknown> = {
	avgElo?: number
	commentCount?: number
	createdAt: IsoAutoDateString
	downloadCount?: number
	durationSeconds?: number
	hasFailed?: boolean
	hasReplay?: boolean
	id: string
	isRanked?: boolean
	likeCount?: number
	lobbyPlayers?: null | TlobbyPlayers
	map: string
	needsResult?: boolean
	playerProfileIdsCsv?: string
	players: null | Tplayers
	replay?: FileNameString
	result?: null | Tresult
	resultAttempts?: number
	sessionId: number
	title: string
	updatedAt: IsoAutoDateString
	user: RecordIdString
	memberReplay?: RecordIdString
}

export type LobbiesLiveRecord<Tplayers = unknown> = {
	createdAt: IsoAutoDateString
	id: string
	isRanked?: boolean
	isReplay?: boolean
	lobby?: RecordIdString
	map: string
	matchType?: number
	players: null | Tplayers
	sessionId: number
	updatedAt: IsoAutoDateString
	user: RecordIdString
}

export type LobbyCommentLikesRecord = {
	comment: RecordIdString
	created: IsoAutoDateString
	id: string
	updated: IsoAutoDateString
	user: RecordIdString
	value?: number
}

export type LobbyCommentsRecord = {
	created: IsoAutoDateString
	deleted?: boolean
	deletedAt?: IsoDateString
	deletedBy?: RecordIdString
	deletedNote?: string
	id: string
	likeCount?: number
	lobby: RecordIdString
	parent?: RecordIdString
	text: string
	updated: IsoAutoDateString
	user: RecordIdString
}

export type LobbyDownloadFingerprintsRecord = {
	created: IsoAutoDateString
	fingerprint: string
	id: string
	lobby: RecordIdString
	updated: IsoAutoDateString
}

export type LobbyDownloadsRecord = {
	created: IsoAutoDateString
	id: string
	lobby: RecordIdString
	updated: IsoAutoDateString
	user: RecordIdString
}

export type LobbyLikesRecord = {
	created: IsoAutoDateString
	id: string
	lobby: RecordIdString
	updated: IsoAutoDateString
	user: RecordIdString
	value?: number
}

export type LobbyPlayerIndexRecord = {
	counts?: boolean
	elo?: number
	id: string
	lobby: RecordIdString
	lobby_user?: string
	map?: string
	matchtype_id?: number
	outcome?: number
	profile_id: number
	race_id?: number
	session_id?: number
	slot?: number
	steam_id?: string
}

export type MapsRecord = {
	created: IsoAutoDateString
	id: string
	map: string
	name?: string
	updated: IsoAutoDateString
}

export type MatchFilterSnapshotsRecord<Tmaps = unknown, Tplayers = unknown> = {
	id: string
	maps?: null | Tmaps
	matchCount?: number
	players?: null | Tplayers
}

export type MemberReplayDownloadFingerprintsRecord = {
	created: IsoAutoDateString
	fingerprint: string
	id: string
	replay: RecordIdString
	updated: IsoAutoDateString
}

export type NotificationReadsRecord = {
	id: string
	notification: RecordIdString
	readAt: IsoAutoDateString
	user: RecordIdString
}

export type NotificationsRecord = {
	body: string
	comment?: RecordIdString
	created: IsoAutoDateString
	createdBy?: RecordIdString
	id: string
	lobby?: RecordIdString
	recipients?: RecordIdString[]
	replay?: RecordIdString
	replayComment?: RecordIdString
	targetAll?: boolean
	title: string
	updated: IsoAutoDateString
}

export type PlayerLabelAssignmentsRecord = {
	alias?: string
	created: IsoAutoDateString
	id: string
	label: RecordIdString
	profileId: number
	steamId: string
	updated: IsoAutoDateString
}

export type PlayerLikesRecord = {
	created: IsoAutoDateString
	id: string
	steamId: string
	updated: IsoAutoDateString
	user: RecordIdString
	value: number
}

export type PlayerRatingsRecord<Telo = unknown> = {
	alias: string
	created: IsoAutoDateString
	elo?: null | Telo
	harvestedAt?: IsoDateString
	id: string
	profileId: number
	steamId: string
	updated: IsoAutoDateString
}

export type PlayerVoteScoresRecord = {
	created: IsoAutoDateString
	id: string
	likeCount?: number
	steamId: string
	updated: IsoAutoDateString
}

export type PlayersRecord = {
	alias?: string
	created: IsoAutoDateString
	id: string
	profile_id: number
	steam_id?: string
	updated: IsoAutoDateString
}

export type ReplayAggregationRecord<Tmaps = unknown, Tplayers = unknown, Tuser = unknown> = {
	id: string
	maps?: null | Tmaps
	players?: null | Tplayers
	user?: null | Tuser
}

export type ReplayCommentLikesRecord = {
	comment: RecordIdString
	created: IsoAutoDateString
	id: string
	updated: IsoAutoDateString
	user: RecordIdString
	value: number
}

export type ReplayCommentsRecord = {
	created: IsoAutoDateString
	deleted?: boolean
	deletedAt?: IsoDateString
	deletedBy?: RecordIdString
	deletedNote?: string
	id: string
	likeCount?: number
	parent?: RecordIdString
	replay: RecordIdString
	text: string
	updated: IsoAutoDateString
	user: RecordIdString
}

export type ReplayLikesRecord = {
	created: IsoAutoDateString
	id: string
	replay: RecordIdString
	updated: IsoAutoDateString
	user: RecordIdString
	value: number
}

export const ReplaysVisibilityOptions = {
	"private": "private",
	"member": "member",
	"deleted": "deleted",
} as const
export type ReplaysVisibilityOptions = typeof ReplaysVisibilityOptions[keyof typeof ReplaysVisibilityOptions]
export type ReplaysRecord<Tmessages = unknown, Tplayers = unknown, TstatsSnapshot = unknown> = {
	commentCount?: number
	createdAt: IsoAutoDateString
	createdBy?: RecordIdString
	description?: string
	downloadCount?: number
	durationInSeconds: number
	file: FileNameString
	filename: string
	gameDate?: IsoDateString
	id: string
	isHighResources?: boolean
	isRandomStart?: boolean
	isRanked?: boolean
	isVpGame?: boolean
	likeCount?: number
	mapFilename: string
	mapName: string
	messages?: null | Tmessages
	players: null | Tplayers
	statsSnapshot?: null | TstatsSnapshot
	title: string
	updatedAt: IsoAutoDateString
	visibility?: ReplaysVisibilityOptions
	vpCount?: number
}

export const ReputationTypesTriggerOptions = {
	"comment_created": "comment_created",
	"comment_received_upvote": "comment_received_upvote",
	"comment_received_downvote": "comment_received_downvote",
	"comment_cast_upvote": "comment_cast_upvote",
	"comment_cast_downvote": "comment_cast_downvote",
	"replay_received_upvote": "replay_received_upvote",
	"replay_received_downvote": "replay_received_downvote",
	"replay_cast_upvote": "replay_cast_upvote",
	"replay_cast_downvote": "replay_cast_downvote",
	"replay_received_download": "replay_received_download",
	"replay_cast_download": "replay_cast_download",
	"match_played": "match_played",
	"player_received_upvote": "player_received_upvote",
	"player_received_downvote": "player_received_downvote",
	"player_cast_upvote": "player_cast_upvote",
	"player_cast_downvote": "player_cast_downvote",
} as const
export type ReputationTypesTriggerOptions = typeof ReputationTypesTriggerOptions[keyof typeof ReputationTypesTriggerOptions]
export type ReputationTypesRecord = {
	created: IsoAutoDateString
	enabled?: boolean
	id: string
	name: string
	score: number
	sort?: number
	trigger: ReputationTypesTriggerOptions
	updated: IsoAutoDateString
}

export const SmurfWatchStatusOptions = {
	"pending_screening": "pending_screening",
	"watching": "watching",
	"resolved": "resolved",
	"not_smurf": "not_smurf",
	"expired": "expired",
	"unknown_private": "unknown_private",
} as const
export type SmurfWatchStatusOptions = typeof SmurfWatchStatusOptions[keyof typeof SmurfWatchStatusOptions]

export const SmurfWatchSourceOptions = {
	"profile": "profile",
	"search": "search",
	"lobby_live": "lobby_live",
	"lobby_match": "lobby_match",
	"backfill": "backfill",
} as const
export type SmurfWatchSourceOptions = typeof SmurfWatchSourceOptions[keyof typeof SmurfWatchSourceOptions]

export const SmurfWatchLenderSourceOptions = {
	"live": "live",
	"cohstats": "cohstats",
} as const
export type SmurfWatchLenderSourceOptions = typeof SmurfWatchLenderSourceOptions[keyof typeof SmurfWatchLenderSourceOptions]

export const SmurfWatchVerdictOptions = {
	"confirmed_shared": "confirmed_shared",
	"likely_smurf": "likely_smurf",
	"suspicious": "suspicious",
	"clean": "clean",
	"unknown": "unknown",
} as const
export type SmurfWatchVerdictOptions = typeof SmurfWatchVerdictOptions[keyof typeof SmurfWatchVerdictOptions]
export type SmurfWatchRecord<Tmain_candidates = unknown, Tsignals = unknown> = {
	account_created_at?: IsoDateString
	check_interval_sec?: number
	coh_playtime_min?: number
	created: IsoAutoDateString
	game_bans?: number
	id: string
	last_checked_at?: IsoDateString
	lender_source?: SmurfWatchLenderSourceOptions
	lender_steam_id?: string
	main_candidates?: null | Tmain_candidates
	main_confidence?: number
	next_check_at?: IsoDateString
	owns_coh?: boolean
	priority?: number
	profile_id?: number
	relic_level?: number
	relic_total_games?: number
	relic_winrate?: number
	score_computed_at?: IsoDateString
	signals?: null | Tsignals
	smurf_score?: number
	source: SmurfWatchSourceOptions
	status: SmurfWatchStatusOptions
	steam_id: string
	suspected_main_steam_id?: string
	updated: IsoAutoDateString
	vac_banned?: boolean
	verdict?: SmurfWatchVerdictOptions
	watching_since?: IsoDateString
}

export type UserLabelsRecord = {
	color: string
	created: IsoAutoDateString
	id: string
	name: string
	sort?: number
	updated: IsoAutoDateString
}

export type UserOverlaysRecord = {
	bundle?: FileNameString
	id: string
	updated: IsoAutoDateString
	user: RecordIdString
	version?: string
}

export type UserReputationRecord = {
	amount: number
	created: IsoAutoDateString
	id: string
	source: string
	type: RecordIdString
	updated: IsoAutoDateString
	user: RecordIdString
}

export type UserReputationTotalsRecord = {
	created: IsoAutoDateString
	id: string
	total: number
	type: RecordIdString
	updated: IsoAutoDateString
	user: RecordIdString
}

export const UsersRoleOptions = {
	"admin": "admin",
	"moderator": "moderator",
} as const
export type UsersRoleOptions = typeof UsersRoleOptions[keyof typeof UsersRoleOptions]
export type UsersRecord<Tmeta = unknown, TsteamIds = unknown> = {
	avatar?: FileNameString
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	lastLogin?: IsoDateString
	meta?: null | Tmeta
	name?: string
	password: string
	reputation?: number
	role?: UsersRoleOptions
	steamIds?: null | TsteamIds
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type AntiCheatCapturesResponse<Texpand = unknown> = Required<AntiCheatCapturesRecord> & BaseSystemFields<Texpand>
export type AntiCheatCheatersResponse<Texpand = unknown> = Required<AntiCheatCheatersRecord> & BaseSystemFields<Texpand>
export type AntiCheatProcessDenylistResponse<Texpand = unknown> = Required<AntiCheatProcessDenylistRecord> & BaseSystemFields<Texpand>
export type AntiCheatProcessHitsResponse<Texpand = unknown> = Required<AntiCheatProcessHitsRecord> & BaseSystemFields<Texpand>
export type AntiCheatModuleAllowlistResponse<Texpand = unknown> = Required<AntiCheatModuleAllowlistRecord> & BaseSystemFields<Texpand>
export type AntiCheatModuleHitsResponse<Texpand = unknown> = Required<AntiCheatModuleHitsRecord> & BaseSystemFields<Texpand>
export type AntiCheatReportsResponse<Texpand = unknown> = Required<AntiCheatReportsRecord> & BaseSystemFields<Texpand>
export type AttachmentsResponse<Texpand = unknown> = Required<AttachmentsRecord> & BaseSystemFields<Texpand>
export type HiddenMatchKeywordsResponse<Texpand = unknown> = Required<HiddenMatchKeywordsRecord> & BaseSystemFields<Texpand>
export type HiddenMatchesResponse<Texpand = unknown> = Required<HiddenMatchesRecord> & BaseSystemFields<Texpand>
export type JobStateResponse<Texpand = unknown> = Required<JobStateRecord> & BaseSystemFields<Texpand>
export type LobbiesResponse<TlobbyPlayers = unknown, Tplayers = unknown, Tresult = unknown, Texpand = unknown> = Required<LobbiesRecord<TlobbyPlayers, Tplayers, Tresult>> & BaseSystemFields<Texpand>
export type LobbiesLiveResponse<Tplayers = unknown, Texpand = unknown> = Required<LobbiesLiveRecord<Tplayers>> & BaseSystemFields<Texpand>
export type LobbyCommentLikesResponse<Texpand = unknown> = Required<LobbyCommentLikesRecord> & BaseSystemFields<Texpand>
export type LobbyCommentsResponse<Texpand = unknown> = Required<LobbyCommentsRecord> & BaseSystemFields<Texpand>
export type LobbyDownloadFingerprintsResponse<Texpand = unknown> = Required<LobbyDownloadFingerprintsRecord> & BaseSystemFields<Texpand>
export type LobbyDownloadsResponse<Texpand = unknown> = Required<LobbyDownloadsRecord> & BaseSystemFields<Texpand>
export type LobbyLikesResponse<Texpand = unknown> = Required<LobbyLikesRecord> & BaseSystemFields<Texpand>
export type LobbyPlayerIndexResponse<Texpand = unknown> = Required<LobbyPlayerIndexRecord> & BaseSystemFields<Texpand>
export type MapsResponse<Texpand = unknown> = Required<MapsRecord> & BaseSystemFields<Texpand>
export type MatchFilterSnapshotsResponse<Tmaps = unknown, Tplayers = unknown, Texpand = unknown> = Required<MatchFilterSnapshotsRecord<Tmaps, Tplayers>> & BaseSystemFields<Texpand>
export type MemberReplayDownloadFingerprintsResponse<Texpand = unknown> = Required<MemberReplayDownloadFingerprintsRecord> & BaseSystemFields<Texpand>
export type NotificationReadsResponse<Texpand = unknown> = Required<NotificationReadsRecord> & BaseSystemFields<Texpand>
export type NotificationsResponse<Texpand = unknown> = Required<NotificationsRecord> & BaseSystemFields<Texpand>
export type PlayerLabelAssignmentsResponse<Texpand = unknown> = Required<PlayerLabelAssignmentsRecord> & BaseSystemFields<Texpand>
export type PlayerLikesResponse<Texpand = unknown> = Required<PlayerLikesRecord> & BaseSystemFields<Texpand>
export type PlayerRatingsResponse<Telo = unknown, Texpand = unknown> = Required<PlayerRatingsRecord<Telo>> & BaseSystemFields<Texpand>
export type PlayerVoteScoresResponse<Texpand = unknown> = Required<PlayerVoteScoresRecord> & BaseSystemFields<Texpand>
export type PlayersResponse<Texpand = unknown> = Required<PlayersRecord> & BaseSystemFields<Texpand>
export type ReplayAggregationResponse<Tmaps = unknown, Tplayers = unknown, Tuser = unknown, Texpand = unknown> = Required<ReplayAggregationRecord<Tmaps, Tplayers, Tuser>> & BaseSystemFields<Texpand>
export type ReplayCommentLikesResponse<Texpand = unknown> = Required<ReplayCommentLikesRecord> & BaseSystemFields<Texpand>
export type ReplayCommentsResponse<Texpand = unknown> = Required<ReplayCommentsRecord> & BaseSystemFields<Texpand>
export type ReplayLikesResponse<Texpand = unknown> = Required<ReplayLikesRecord> & BaseSystemFields<Texpand>
export type ReplaysResponse<Tmessages = unknown, Tplayers = unknown, TstatsSnapshot = unknown, Texpand = unknown> = Required<ReplaysRecord<Tmessages, Tplayers, TstatsSnapshot>> & BaseSystemFields<Texpand>
export type ReputationTypesResponse<Texpand = unknown> = Required<ReputationTypesRecord> & BaseSystemFields<Texpand>
export type SmurfWatchResponse<Tmain_candidates = unknown, Tsignals = unknown, Texpand = unknown> = Required<SmurfWatchRecord<Tmain_candidates, Tsignals>> & BaseSystemFields<Texpand>
export type UserLabelsResponse<Texpand = unknown> = Required<UserLabelsRecord> & BaseSystemFields<Texpand>
export type UserOverlaysResponse<Texpand = unknown> = Required<UserOverlaysRecord> & BaseSystemFields<Texpand>
export type UserReputationResponse<Texpand = unknown> = Required<UserReputationRecord> & BaseSystemFields<Texpand>
export type UserReputationTotalsResponse<Texpand = unknown> = Required<UserReputationTotalsRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Tmeta = unknown, TsteamIds = unknown, Texpand = unknown> = Required<UsersRecord<Tmeta, TsteamIds>> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	anti_cheat_captures: AntiCheatCapturesRecord
	anti_cheat_cheaters: AntiCheatCheatersRecord
	anti_cheat_process_denylist: AntiCheatProcessDenylistRecord
	anti_cheat_process_hits: AntiCheatProcessHitsRecord
	anti_cheat_module_allowlist: AntiCheatModuleAllowlistRecord
	anti_cheat_module_hits: AntiCheatModuleHitsRecord
	anti_cheat_reports: AntiCheatReportsRecord
	attachments: AttachmentsRecord
	hidden_match_keywords: HiddenMatchKeywordsRecord
	hidden_matches: HiddenMatchesRecord
	job_state: JobStateRecord
	lobbies: LobbiesRecord
	lobbies_live: LobbiesLiveRecord
	lobby_comment_likes: LobbyCommentLikesRecord
	lobby_comments: LobbyCommentsRecord
	lobby_download_fingerprints: LobbyDownloadFingerprintsRecord
	lobby_downloads: LobbyDownloadsRecord
	lobby_likes: LobbyLikesRecord
	lobby_player_index: LobbyPlayerIndexRecord
	maps: MapsRecord
	match_filter_snapshots: MatchFilterSnapshotsRecord
	member_replay_download_fingerprints: MemberReplayDownloadFingerprintsRecord
	notification_reads: NotificationReadsRecord
	notifications: NotificationsRecord
	player_label_assignments: PlayerLabelAssignmentsRecord
	player_likes: PlayerLikesRecord
	player_ratings: PlayerRatingsRecord
	player_vote_scores: PlayerVoteScoresRecord
	players: PlayersRecord
	replay_aggregation: ReplayAggregationRecord
	replay_comment_likes: ReplayCommentLikesRecord
	replay_comments: ReplayCommentsRecord
	replay_likes: ReplayLikesRecord
	replays: ReplaysRecord
	reputation_types: ReputationTypesRecord
	smurf_watch: SmurfWatchRecord
	user_labels: UserLabelsRecord
	user_overlays: UserOverlaysRecord
	user_reputation: UserReputationRecord
	user_reputation_totals: UserReputationTotalsRecord
	users: UsersRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	anti_cheat_captures: AntiCheatCapturesResponse
	anti_cheat_cheaters: AntiCheatCheatersResponse
	anti_cheat_process_denylist: AntiCheatProcessDenylistResponse
	anti_cheat_process_hits: AntiCheatProcessHitsResponse
	anti_cheat_module_allowlist: AntiCheatModuleAllowlistResponse
	anti_cheat_module_hits: AntiCheatModuleHitsResponse
	anti_cheat_reports: AntiCheatReportsResponse
	attachments: AttachmentsResponse
	hidden_match_keywords: HiddenMatchKeywordsResponse
	hidden_matches: HiddenMatchesResponse
	job_state: JobStateResponse
	lobbies: LobbiesResponse
	lobbies_live: LobbiesLiveResponse
	lobby_comment_likes: LobbyCommentLikesResponse
	lobby_comments: LobbyCommentsResponse
	lobby_download_fingerprints: LobbyDownloadFingerprintsResponse
	lobby_downloads: LobbyDownloadsResponse
	lobby_likes: LobbyLikesResponse
	lobby_player_index: LobbyPlayerIndexResponse
	maps: MapsResponse
	match_filter_snapshots: MatchFilterSnapshotsResponse
	member_replay_download_fingerprints: MemberReplayDownloadFingerprintsResponse
	notification_reads: NotificationReadsResponse
	notifications: NotificationsResponse
	player_label_assignments: PlayerLabelAssignmentsResponse
	player_likes: PlayerLikesResponse
	player_ratings: PlayerRatingsResponse
	player_vote_scores: PlayerVoteScoresResponse
	players: PlayersResponse
	replay_aggregation: ReplayAggregationResponse
	replay_comment_likes: ReplayCommentLikesResponse
	replay_comments: ReplayCommentsResponse
	replay_likes: ReplayLikesResponse
	replays: ReplaysResponse
	reputation_types: ReputationTypesResponse
	smurf_watch: SmurfWatchResponse
	user_labels: UserLabelsResponse
	user_overlays: UserOverlaysResponse
	user_reputation: UserReputationResponse
	user_reputation_totals: UserReputationTotalsResponse
	users: UsersResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
