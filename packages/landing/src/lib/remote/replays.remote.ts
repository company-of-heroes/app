import { form, command, query, getRequestEvent } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { MemberReplayPreviewPlayer } from '$lib/replays/member-rating-preview';

const boolString = z.enum(['true', 'false']).transform((value) => value === 'true');

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
	title: z
		.string()
		.trim()
		.min(1, 'Title is required.')
		.max(200),
	description: z.string().trim().min(1, 'Description is required.').max(2000),
	mapName: z.string().trim().min(1).max(200),
	mapFilename: z.string().trim().min(1).max(200),
	durationInSeconds: z.string().transform((value) => {
		const n = Number(value);
		return Number.isFinite(n) && n >= 0 ? n : 0;
	}),
	gameDate: z.string().optional().default(''),
	isRanked: boolString,
	isVpGame: boolString,
	isRandomStart: boolString,
	isHighResources: boolString,
	vpCount: z.string().transform((value) => {
		const n = Number(value);
		return Number.isFinite(n) ? n : 0;
	}),
	players: z.string().transform((raw, ctx) => {
		try {
			return JSON.parse(raw || '[]') as unknown;
		} catch {
			ctx.addIssue({ code: 'custom', message: 'Invalid replay metadata.' });
			return [];
		}
	}),
	messages: z.string().transform((raw, ctx) => {
		try {
			return JSON.parse(raw || '[]') as unknown;
		} catch {
			ctx.addIssue({ code: 'custom', message: 'Invalid replay metadata.' });
			return [];
		}
	})
});

export const uploadMemberReplay = form(uploadMemberReplaySchema, async (data) => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Sign in to upload a member replay.'));
	}

	const result = await locals.services.replays().uploadMember({
		file: data.file,
		filename: data.filename,
		title: data.title || '-',
		description: data.description,
		mapName: data.mapName,
		mapFilename: data.mapFilename,
		durationInSeconds: data.durationInSeconds,
		gameDate: data.gameDate || undefined,
		isRanked: data.isRanked,
		isVpGame: data.isVpGame,
		isRandomStart: data.isRandomStart,
		isHighResources: data.isHighResources,
		vpCount: data.vpCount,
		players: data.players,
		messages: data.messages
	});

	if (result.isErr()) {
		invalid(locals.t(result.error.message));
	}

	redirect(303, `/replays/${result.value.id}`);
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
			locals.services.replays().previewMemberStats({
				players: players as MemberReplayPreviewPlayer[],
				isRanked,
				durationInSeconds
			})
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

	const players = await unwrapAsync(locals.services.players().search(q, { requireMatches: true }));
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
	players: z.string().transform((raw, ctx) => {
		try {
			return JSON.parse(raw || '[]') as unknown;
		} catch {
			ctx.addIssue({ code: 'custom', message: 'Invalid replay metadata.' });
			return [];
		}
	})
});

export const updateMemberReplay = form(updateMemberReplaySchema, async (data) => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Sign in to edit a member replay.'));
	}

	const result = await locals.services.replays().updateMember(data.id, {
		title: data.title,
		description: data.description,
		players: data.players
	});

	if (result.isErr()) {
		invalid(locals.t(result.error.message));
	}

	redirect(303, `/replays/${result.value.id}`);
});

const deleteMemberReplaySchema = z.object({
	id: z.string().min(1)
});

export const deleteMemberReplay = form(deleteMemberReplaySchema, async (data) => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Sign in to delete a member replay.'));
	}

	const result = await locals.services.replays().deleteMember(data.id);
	if (result.isErr()) {
		invalid(locals.t(result.error.message));
	}

	redirect(303, '/replays?tab=member');
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
			locals.services.replays().publishFromMatch(lobbyId, {
				title,
				description,
				durationInSeconds,
				players
			})
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
	({ matchId, visitorId, kind }) => {
		const { locals, getClientAddress } = getRequestEvent();
		const replays = locals.services.replays();
		const ip = getClientAddress();
		if (kind === 'member') {
			return unwrapAsync(replays.downloadMember(matchId, visitorId, ip));
		}

		return unwrapAsync(replays.download(matchId, visitorId, ip));
	}
);
