import { z } from 'zod'

const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?Z$/

export const usersSchema = z.object({
    collectionId: z.literal('_pb_users_auth_').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    password: z.string().min(8).max(71),
    tokenKey: z.string().min(30).max(60).optional(),
    email: z.string().email(),
    emailVisibility: z.boolean().optional(),
    verified: z.boolean().optional(),
    avatar: z.string().optional(),
    name: z.string().max(255).optional(),
    steamIds: z.unknown().optional(),
    meta: z.unknown().optional(),
    lastLogin: z.string().regex(DATETIME_REGEX).optional(),
    role: z.enum(['admin', 'moderator']).optional(),
    created: z.string().regex(DATETIME_REGEX).optional(),
    updated: z.string().regex(DATETIME_REGEX).optional(),
})

export const lobbiesSchema = z.object({
    collectionId: z.literal('pbc_1574334436').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    user: z.string().regex(/^[a-z0-9]+$/).length(15),
    isRanked: z.boolean().optional(),
    sessionId: z.number().refine((n) => n !== 0),
    title: z.string().min(1).max(5000),
    map: z.string().min(1).max(5000),
    players: z.unknown(),
    result: z.unknown().optional(),
    needsResult: z.boolean().optional(),
    replay: z.string().optional(),
    createdAt: z.string().regex(DATETIME_REGEX).optional(),
    updatedAt: z.string().regex(DATETIME_REGEX).optional(),
})

export const replaysSchema = z.object({
    collectionId: z.literal('pbc_3644265509').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    title: z.string().min(1).max(5000),
    filename: z.string().min(1).max(5000),
    mapFilename: z.string().min(1).max(5000),
    mapName: z.string().min(1).max(5000),
    gameDate: z.string().regex(DATETIME_REGEX).optional(),
    isRanked: z.boolean().optional(),
    isVpGame: z.boolean().optional(),
    isRandomStart: z.boolean().optional(),
    isHighResources: z.boolean().optional(),
    vpCount: z.number().optional(),
    durationInSeconds: z.number().refine((n) => n !== 0),
    players: z.unknown(),
    messages: z.unknown().optional(),
    file: z.string(),
    createdBy: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    createdAt: z.string().regex(DATETIME_REGEX).optional(),
    updatedAt: z.string().regex(DATETIME_REGEX).optional(),
})

export const lobbyAggregationSchema = z.object({
    collectionId: z.literal('pbc_1750043174').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).min(1).max(5000),
    USER: z.unknown().optional(),
    players: z.unknown().optional(),
    maps: z.unknown().optional(),
})

export const replayAggregationSchema = z.object({
    collectionId: z.literal('pbc_3632852221').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).min(1).max(5000),
    user: z.unknown().optional(),
    players: z.unknown().optional(),
    maps: z.unknown().optional(),
})

export const lobbyAggregationCommunitySchema = z.object({
    collectionId: z.literal('pbc_3080897202').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).min(1).max(5000),
    players: z.unknown().optional(),
    maps: z.unknown().optional(),
    users: z.unknown().optional(),
})

export const chatSchema = z.object({
    collectionId: z.literal('pbc_1116771610').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    user: z.string().regex(/^[a-z0-9]+$/).length(15),
    message: z.string().max(500).optional(),
    attachments: z.string().regex(/^[a-z0-9]+$/).length(15).array().max(999).optional(),
    created: z.string().regex(DATETIME_REGEX).optional(),
    updated: z.string().regex(DATETIME_REGEX).optional(),
})

export const attachmentsSchema = z.object({
    collectionId: z.literal('pbc_3073759650').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    type: z.string().min(1).max(5000),
    file: z.string(),
    created: z.string().regex(DATETIME_REGEX).optional(),
    updated: z.string().regex(DATETIME_REGEX).optional(),
})

export const chatRoomsSchema = z.object({
    collectionId: z.literal('pbc_2204944285').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    members: z.string().regex(/^[a-z0-9]+$/).length(15).array().max(9999).optional(),
    created: z.string().regex(DATETIME_REGEX).optional(),
    updated: z.string().regex(DATETIME_REGEX).optional(),
})

export const chatMessagesSchema = z.object({
    collectionId: z.literal('pbc_102036695').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    sender: z.string().regex(/^[a-z0-9]+$/).length(15),
    chatRoom: z.string().regex(/^[a-z0-9]+$/).min(1).max(5000),
    text: z.string().max(5000).optional(),
    attachments: z.string().regex(/^[a-z0-9]+$/).length(15).array().max(999).optional(),
    created: z.string().regex(DATETIME_REGEX).optional(),
    updated: z.string().regex(DATETIME_REGEX).optional(),
})

export const commentsSchema = z.object({
    collectionId: z.literal('pbc_533777971').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    text: z.string().min(1).max(5000),
    sender: z.string().regex(/^[a-z0-9]+$/).length(15),
    isDeleted: z.boolean().optional(),
    likes: z.string().regex(/^[a-z0-9]+$/).length(15).array().max(999).optional(),
    dislikes: z.string().regex(/^[a-z0-9]+$/).length(15).array().max(999).optional(),
    mentions: z.string().regex(/^[a-z0-9]+$/).length(15).array().max(999).optional(),
    parent: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    created: z.string().regex(DATETIME_REGEX).optional(),
    updated: z.string().regex(DATETIME_REGEX).optional(),
})

export const lobbyCommentsSchema = z.object({
    collectionId: z.literal('pbc_673294823').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    lobby: z.string().regex(/^[a-z0-9]+$/).length(15),
    comment: z.string().regex(/^[a-z0-9]+$/).length(15),
    created: z.string().regex(DATETIME_REGEX).optional(),
    updated: z.string().regex(DATETIME_REGEX).optional(),
})

export const lobbiesLiveSchema = z.object({
    collectionId: z.literal('pbc_908767333').optional(),
    collectionName: z.string().min(1).max(255).optional(),
    id: z.string().regex(/^[a-z0-9]+$/).length(15).optional(),
    user: z.string().regex(/^[a-z0-9]+$/).length(15),
    isRanked: z.boolean().optional(),
    sessionId: z.number().refine((n) => n !== 0),
    map: z.string().min(1).max(5000),
    players: z.unknown(),
    createdAt: z.string().regex(DATETIME_REGEX).optional(),
    updatedAt: z.string().regex(DATETIME_REGEX).optional(),
})

