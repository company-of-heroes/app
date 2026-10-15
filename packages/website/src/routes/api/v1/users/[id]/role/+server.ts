import { z } from 'zod';
import { handle, parseBody, requireAdmin } from '$lib/server/http';

const body = z.object({ role: z.enum(['editor', 'host']).nullable() });

/** Admins give a user the editor or host role, or take it away (`role: null`). */
export const PATCH = handle((event) =>
	requireAdmin(event).asyncAndThen((actor) =>
		parseBody(body, event.request).andThen(({ role }) =>
			event.locals.services.users.setRole(event.params.id!, role, actor)
		)
	)
);
