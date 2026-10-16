import { z } from 'zod';
import { handle, parseBody, requireUser } from '$lib/server/http';

const hiddenSchema = z.object({ hidden: z.boolean() });

/** The signed-in user's supporter status. */
export const GET = handle((event) =>
	requireUser(event).asyncAndThen((user) => event.locals.services.subscriptions.status(user.id))
);

/** Hides or shows the signed-in user on the supporters page. */
export const PATCH = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(hiddenSchema, event.request).andThen(({ hidden }) =>
			event.locals.services.subscriptions.setHidden(user.id, hidden)
		)
	)
);
