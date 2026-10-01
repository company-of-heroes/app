import { err, ok } from 'neverthrow';
import { z } from 'zod';
import { forbidden } from '$lib/server/errors';
import { handle, parseBody, requireStaff } from '$lib/server/http';

const body = z.object({
	keeperId: z.string().min(1),
	userIds: z.array(z.string().min(1)).min(1).max(10)
});

/** Admins merge duplicate accounts into the one they pick; the keeper keeps its own role. */
export const POST = handle((event) =>
	requireStaff(event)
		.andThen((user) => (user.role === 'admin' ? ok(user) : err(forbidden('Only admins can merge accounts.'))))
		.asyncAndThen(() => parseBody(body, event.request))
		.andThen(({ keeperId, userIds }) => event.locals.services.users.mergeAccounts(keeperId, userIds))
);
