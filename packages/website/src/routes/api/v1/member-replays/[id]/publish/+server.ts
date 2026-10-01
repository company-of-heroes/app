import { z } from 'zod';
import { handle, parseBody, requireUser } from '$lib/server/http';

const body = z.object({ description: z.string().trim().max(2000).optional() });

/** The owner publishes one of their private replays to Member replays. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(body, event.request).andThen(({ description }) =>
			event.locals.services.memberReplays.publishPrivate(
				event.params.id ?? '',
				user.id,
				description
			)
		)
	)
);
