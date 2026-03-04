/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export enum Collections {
	Authorigins = "_authOrigins",
	Externalauths = "_externalAuths",
	Mfas = "_mfas",
	Otps = "_otps",
	Superusers = "_superusers",
	Attachments = "attachments",
	Chat = "chat",
	ChatMessages = "chat_messages",
	ChatRooms = "chat_rooms",
	Comments = "comments",
	Lobbies = "lobbies",
	LobbyAggregation = "lobby_aggregation",
	LobbyAggregationCommunity = "lobby_aggregation_community",
	LobbyComments = "lobby_comments",
	ReplayAggregation = "replay_aggregation",
	Replays = "replays",
	Users = "users",
}

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

export type AttachmentsRecord = {
	created: IsoAutoDateString
	file: FileNameString
	id: string
	type: string
	updated: IsoAutoDateString
}

export type ChatRecord = {
	attachments?: RecordIdString[]
	created: IsoAutoDateString
	id: string
	message?: string
	updated: IsoAutoDateString
	user: RecordIdString
}

export type ChatMessagesRecord = {
	attachments?: RecordIdString[]
	chatRoom: string
	created: IsoAutoDateString
	id: string
	sender: RecordIdString
	text?: string
	updated: IsoAutoDateString
}

export type ChatRoomsRecord = {
	created: IsoAutoDateString
	id: string
	members?: RecordIdString[]
	updated: IsoAutoDateString
}

export type CommentsRecord = {
	created: IsoAutoDateString
	dislikes?: RecordIdString[]
	id: string
	isDeleted?: boolean
	likes?: RecordIdString[]
	mentions?: RecordIdString[]
	parent?: RecordIdString
	sender: RecordIdString
	text: string
	updated: IsoAutoDateString
}

export type LobbiesRecord<Tplayers = unknown, Tresult = unknown> = {
	createdAt: IsoAutoDateString
	id: string
	isRanked?: boolean
	map: string
	needsResult?: boolean
	players: null | Tplayers
	replay?: FileNameString
	result?: null | Tresult
	sessionId: number
	title: string
	updatedAt: IsoAutoDateString
	user: RecordIdString
}

export type LobbyAggregationRecord<Tmaps = unknown, Tplayers = unknown, Tuser = unknown> = {
	id: string
	maps?: null | Tmaps
	players?: null | Tplayers
	user?: null | Tuser
}

export type LobbyAggregationCommunityRecord<Tmaps = unknown, Tplayers = unknown, Tusers = unknown> = {
	id: string
	maps?: null | Tmaps
	players?: null | Tplayers
	users?: null | Tusers
}

export type LobbyCommentsRecord = {
	comment: RecordIdString
	created: IsoAutoDateString
	id: string
	lobby: RecordIdString
	updated: IsoAutoDateString
}

export type ReplayAggregationRecord<Tmaps = unknown, Tplayers = unknown, Tuser = unknown> = {
	id: string
	maps?: null | Tmaps
	players?: null | Tplayers
	user?: null | Tuser
}

export type ReplaysRecord<Tmessages = unknown, Tplayers = unknown> = {
	createdAt: IsoAutoDateString
	createdBy?: RecordIdString
	durationInSeconds: number
	file: FileNameString
	filename: string
	gameDate?: IsoDateString
	id: string
	isHighResources?: boolean
	isRandomStart?: boolean
	isRanked?: boolean
	isVpGame?: boolean
	mapFilename: string
	mapName: string
	messages?: null | Tmessages
	players: null | Tplayers
	title: string
	updatedAt: IsoAutoDateString
	vpCount?: number
}

export enum UsersRoleOptions {
	"admin" = "admin",
	"moderator" = "moderator",
}
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
export type AttachmentsResponse<Texpand = unknown> = Required<AttachmentsRecord> & BaseSystemFields<Texpand>
export type ChatResponse<Texpand = unknown> = Required<ChatRecord> & BaseSystemFields<Texpand>
export type ChatMessagesResponse<Texpand = unknown> = Required<ChatMessagesRecord> & BaseSystemFields<Texpand>
export type ChatRoomsResponse<Texpand = unknown> = Required<ChatRoomsRecord> & BaseSystemFields<Texpand>
export type CommentsResponse<Texpand = unknown> = Required<CommentsRecord> & BaseSystemFields<Texpand>
export type LobbiesResponse<Tplayers = unknown, Tresult = unknown, Texpand = unknown> = Required<LobbiesRecord<Tplayers, Tresult>> & BaseSystemFields<Texpand>
export type LobbyAggregationResponse<Tmaps = unknown, Tplayers = unknown, Tuser = unknown, Texpand = unknown> = Required<LobbyAggregationRecord<Tmaps, Tplayers, Tuser>> & BaseSystemFields<Texpand>
export type LobbyAggregationCommunityResponse<Tmaps = unknown, Tplayers = unknown, Tusers = unknown, Texpand = unknown> = Required<LobbyAggregationCommunityRecord<Tmaps, Tplayers, Tusers>> & BaseSystemFields<Texpand>
export type LobbyCommentsResponse<Texpand = unknown> = Required<LobbyCommentsRecord> & BaseSystemFields<Texpand>
export type ReplayAggregationResponse<Tmaps = unknown, Tplayers = unknown, Tuser = unknown, Texpand = unknown> = Required<ReplayAggregationRecord<Tmaps, Tplayers, Tuser>> & BaseSystemFields<Texpand>
export type ReplaysResponse<Tmessages = unknown, Tplayers = unknown, Texpand = unknown> = Required<ReplaysRecord<Tmessages, Tplayers>> & BaseSystemFields<Texpand>
export type UsersResponse<Tmeta = unknown, TsteamIds = unknown, Texpand = unknown> = Required<UsersRecord<Tmeta, TsteamIds>> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	attachments: AttachmentsRecord
	chat: ChatRecord
	chat_messages: ChatMessagesRecord
	chat_rooms: ChatRoomsRecord
	comments: CommentsRecord
	lobbies: LobbiesRecord
	lobby_aggregation: LobbyAggregationRecord
	lobby_aggregation_community: LobbyAggregationCommunityRecord
	lobby_comments: LobbyCommentsRecord
	replay_aggregation: ReplayAggregationRecord
	replays: ReplaysRecord
	users: UsersRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	attachments: AttachmentsResponse
	chat: ChatResponse
	chat_messages: ChatMessagesResponse
	chat_rooms: ChatRoomsResponse
	comments: CommentsResponse
	lobbies: LobbiesResponse
	lobby_aggregation: LobbyAggregationResponse
	lobby_aggregation_community: LobbyAggregationCommunityResponse
	lobby_comments: LobbyCommentsResponse
	replay_aggregation: ReplayAggregationResponse
	replays: ReplaysResponse
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
