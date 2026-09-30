import { command, query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import {
	memberUpdateSchema,
	memberUploadSchema,
	publishFromMatchSchema
} from '$lib/server/domain/member-replay-writes';
import { countDownload } from '$lib/server/downloads';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { MemberReplayPreviewPlayer } from '$lib/replays/member-rating-preview';

const uploadMemberReplaySchema = z.object({
	file: z
		.instanceof(File)
		.refine((file) => file.size > 0, 'Replay file is required.')
		.refine((file) => file.size >= 64, 'Replay file is empty or corrupt.')
		.refine(
			(file) => file.name.toLowerCase().endsWith('.rec'),
			'Only .rec replay files are supported.'
		),
	filename: z.string().trim().min(1).max(255),
	title: z.string().trim().min(1, 'Title is required.').max(200),
	description: z.string().trim().min(1, 'Description is required.').max(2000),
	mapName: z.string().trim().min(1).max(200),
	mapFilename: z.string().trim().min(1).max(200),
	durationInSeconds: z.number().nonnegative(),
	gameDate: z.string().optional().default(''),
	isRanked: z.boolean(),
	isVpGame: z.boolean(),
	isRandomStart: z.boolean(),
	isHighResources: z.boolean(),
	vpCount: z.number(),
	players: z.array(z.unknown()),
	messages: z.array(z.unknown())
});

/** Shared uploader (`@company-of-heroes/ui/replay`) submits the parsed replay + file here. */
export const uploadMemberReplay = command(uploadMemberReplaySchema, async (data) => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Sign in to upload a member replay.'));
	}

	const { file, ...metadata } = data;
	const replay = await unwrapAsync(
		locals.services.memberReplays.upload(locals.user.id, file, memberUploadSchema.parse(metadata))
	);
	return { id: replay.id };
});

const previewMemberReplayRatingsSchema = z.object({
	players: z.array(
		z.object({
			name: z.string().optional(),
			alias: z.string().optional(),
			steamId: z
				.union([z.string(), z.number()])
				.nullable()
				.optional()
				.transform((value) => (value == null || value === '' ? null : String(value))),
			faction: z.string().optional(),
			id: z.number().nullable().optional()
		})
	),
	isRanked: z.boolean(),
	durationInSeconds: z.number().optional()
});

export const previewMemberReplayRatings = query(
	previewMemberReplayRatingsSchema,
	async ({ players, isRanked, durationInSeconds }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) {
			error(401, locals.t('Sign in to upload a member replay.'));
		}

		return unwrapAsync(
			locals.services.memberReplays.previewStats(
				players as MemberReplayPreviewPlayer[],
				isRanked,
				durationInSeconds ?? 0
			)
		);
	}
);

const searchPlayersForUploadSchema = z.object({
	q: z.string().trim().max(100)
});

export const searchPlayersForUpload = query(searchPlayersForUploadSchema, async ({ q }) => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Sign in to upload a member replay.'));
	}

	if (!q) {
		return [] as {
			value: string;
			label: string;
			avatarUrl: string | null;
			country: string | null;
			profileId: number | null;
		}[];
	}

	const players = await unwrapAsync(locals.services.players.search(q, true));
	return players.map((player) => ({
		value: player.steamId,
		label: player.alias || player.steamId,
		avatarUrl: player.avatarUrl || null,
		country: player.country ?? null,
		profileId: player.profileId || null
	}));
});

const updateMemberReplaySchema = z.object({
	id: z.string().min(1),
	title: z.string().trim().min(1, 'Title is required.').max(200),
	description: z.string().trim().min(1, 'Description is required.').max(2000),
	players: z.array(z.unknown())
});

/** Shared edit form (`@company-of-heroes/ui/replay`): owner edits title/description/roster. */
export const updateMemberReplay = command(updateMemberReplaySchema, async (data) => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Sign in to edit a member replay.'));
	}

	const { id, ...changes } = data;
	await unwrapAsync(
		locals.services.memberReplays.update(id, locals.user.id, memberUpdateSchema.parse(changes))
	);
});

const deleteMemberReplaySchema = z.object({
	id: z.string().min(1)
});

export const deleteMemberReplay = command(deleteMemberReplaySchema, async ({ id }) => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Sign in to delete a member replay.'));
	}

	await unwrapAsync(locals.services.memberReplays.remove(id, locals.user.id));
});

const publishMatchAsMemberReplaySchema = z.object({
	lobbyId: z.string().min(1),
	title: z.string().trim().min(1, 'Title is required.').max(200),
	description: z.string().trim().min(1, 'Description is required.').max(2000),
	durationInSeconds: z.number().nonnegative().optional(),
	players: z.array(z.unknown()).optional()
});

export const publishMatchAsMemberReplay = command(
	publishMatchAsMemberReplaySchema,
	async ({ lobbyId, title, description, durationInSeconds, players }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) {
			error(401, locals.t('Sign in to publish a member replay.'));
		}

		return unwrapAsync(
			locals.services.memberReplays.publishFromMatch(
				lobbyId,
				locals.user.id,
				publishFromMatchSchema.parse({ title, description, durationInSeconds, players })
			)
		);
	}
);

const recordReplayDownloadSchema = z.object({
	matchId: z.string().min(1),
	visitorId: z.uuid(),
	kind: z.enum(['match', 'member']).optional()
});

export const recordReplayDownload = command(
	recordReplayDownloadSchema,
	({ matchId, visitorId, kind }) =>
		unwrapAsync(
			countDownload(getRequestEvent(), kind === 'member' ? 'replay' : 'lobby', matchId, visitorId)
		)
);
