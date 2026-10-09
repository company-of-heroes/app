import { z } from 'zod';
import {
	TOURNAMENT_BEST_OF,
	TOURNAMENT_FORMATS,
	TOURNAMENT_REPORT_REASONS,
	TOURNAMENT_SCHEDULE_MAX_TIMES
} from '@company-of-heroes/api';

const bestOf = z
	.number()
	.int()
	.refine((value) => (TOURNAMENT_BEST_OF as readonly number[]).includes(value));

/** An ISO date, or null to clear it. */
const date = z.iso.datetime({ offset: true }).nullable();

export const tournamentInput = z.object({
	name: z.string().trim().min(1).max(120),
	description: z.string().max(5000),
	rules: z.string().max(5000),
	format: z.enum(TOURNAMENT_FORMATS),
	bestOf,
	finalsBestOf: bestOf.nullable(),
	grandFinalReset: z.boolean(),
	registrationClosesAt: date,
	startsAt: date,
	maxParticipants: z.number().int().min(2).max(256).nullable(),
	mapPool: z.array(z.string().trim().min(1).max(120)).max(50),
	medal: z
		.string()
		.regex(/^medal-\d{3}$/)
		.nullable()
		.optional(),
	streamUrl: z
		.url({ protocol: /^https$/ })
		.max(500)
		.nullable()
		.optional()
});

export const tournamentUpdate = tournamentInput.partial().extend({
	status: z.enum(['draft', 'registration', 'cancelled']).optional()
});

export const tournamentScope = z.object({
	scope: z.enum(['active', 'upcoming', 'past']).default('active')
});

const steamId = z.string().regex(/^7656119\d{10}$/);

/** `acceptRules` must be true when the tournament has rules (checked by the service). */
export const registrationBody = z.object({ steamId, acceptRules: z.boolean().default(false) });

export const steamIdParam = z.object({ steamId });

export const seedOrderBody = z.object({ order: z.array(z.string().min(1).max(15)).max(256) });

const slot = z.enum(['A', 'B']);

export const matchResultBody = z.union([
	z.object({ winsA: z.number().int().min(0).max(4), winsB: z.number().int().min(0).max(4) }),
	z.object({ walkover: slot }),
	z.object({ reset: z.literal(true) })
]);

const clearFlags = z.object({
	clearBanner: z.boolean().optional(),
	clearLogo: z.boolean().optional()
});

/** Images from a multipart body (`readRecordBody`); non-file values are ignored. */
export function imagesFrom(data: Record<string, unknown>, files: Record<string, File>) {
	const flags = clearFlags.safeParse(data);
	return {
		banner: files.banner ?? null,
		logo: files.logo ?? null,
		clearBanner: flags.success ? flags.data.clearBanner : false,
		clearLogo: flags.success ? flags.data.clearLogo : false
	};
}

/** An ISO date, or null to use the round's deadline / clear it. */
const deadline = z.iso.datetime({ offset: true }).nullable();

/** Round deadlines by `roundKey` (e.g. `winners:1`). */
export const roundDeadlinesBody = z.object({
	rounds: z.record(z.string().regex(/^(winners|losers|grand_final|round_robin):\d{1,2}$/), deadline)
});

export const matchDeadlineBody = z.object({ deadline });

/** The lobby that just started: its Relic session and the players' Steam ids. */
export const claimBody = z.object({
	sessionId: z.number().int().positive(),
	steamIds: z
		.array(z.string().regex(/^7656119\d{10}$/))
		.min(2)
		.max(8)
});

export const seenBody = z.object({
	lobbyIds: z.array(z.string().max(15)).max(100).default([]),
	started: z.array(z.string().max(15)).max(50).default([]),
	posts: z.array(z.string().max(15)).max(50).default([])
});

export const postBody = z.object({
	title: z.string().trim().max(200).default(''),
	body: z.string().max(20000).default(''),
	important: z.boolean().default(false),
	pinned: z.boolean().default(false)
});

export const reportUpdateBody = z.object({
	status: z.enum(['open', 'resolved', 'dismissed']),
	staffNote: z.string().trim().max(2000).default('')
});

/** 1–3 proposed match times (checked against now and the deadline by the service). */
export const scheduleBody = z.object({
	times: z
		.array(z.iso.datetime({ offset: true }))
		.min(1)
		.max(TOURNAMENT_SCHEDULE_MAX_TIMES)
});

export const acceptTimeBody = z.object({ time: z.iso.datetime({ offset: true }) });

export const matchTimeBody = z.object({ scheduledAt: z.iso.datetime({ offset: true }).nullable() });

export const featureBody = z.object({ matchId: z.string().min(1).max(15).nullable() });

export const reportBody = z.object({
	reason: z.enum(TOURNAMENT_REPORT_REASONS),
	message: z.string().trim().max(2000).default('')
});
