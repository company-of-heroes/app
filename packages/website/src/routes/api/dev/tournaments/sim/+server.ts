import { dev } from '$app/environment';
import type { RequestEvent } from '@sveltejs/kit';
import { err } from 'neverthrow';
import { z } from 'zod';
import { TOURNAMENT_FORMATS } from '@company-of-heroes/api/tournaments';
import { notFound } from '$lib/server/errors';
import { handle, parseBody, parseQuery, requireStaff } from '$lib/server/http';
import type { SimAction } from '$lib/server/services/dev-tournament-sim';

/** Local development only: the tournament simulator (`/tournaments/simulate`). */
const slug = z.string().regex(/^sim-\d+$/, 'Not a simulated tournament.');

const createOptions = z
	.object({
		players: z.union([z.literal(4), z.literal(8), z.literal(16)]).default(8),
		format: z.enum(TOURNAMENT_FORMATS).default('double_elim'),
		bestOf: z.union([z.literal(1), z.literal(3)]).default(1),
		includeMe: z.boolean().default(false)
	})
	.prefault({});

const actionSchema = z.discriminatedUnion('action', [
	z.object({ action: z.enum(['create', 'runAll']), options: createOptions }),
	z.object({ action: z.literal('playMatch'), slug, matchId: z.string().min(1).optional() }),
	z.object({
		action: z.enum([
			'register',
			'rulesChange',
			'close',
			'start',
			'feature',
			'schedule',
			'report',
			'overdue',
			'disqualify',
			'playRound',
			'finish'
		]),
		slug
	}),
	z.object({ action: z.literal('reset') })
]);

const querySchema = z.object({ slug: slug.optional() });

function staffInDev(event: RequestEvent) {
	return dev ? requireStaff(event) : err(notFound('Not found'));
}

export const GET = handle((event) =>
	staffInDev(event).asyncAndThen((staff) =>
		parseQuery(querySchema, event.url).asyncAndThen(({ slug }) =>
			event.locals.services.devTournamentSim.overview(staff, slug ?? null)
		)
	)
);

export const POST = handle((event) =>
	staffInDev(event).asyncAndThen((staff) =>
		parseBody(actionSchema, event.request).andThen((input) =>
			event.locals.services.devTournamentSim
				.run(staff, input as SimAction)
				.map((steps) => ({ steps }))
		)
	)
);
