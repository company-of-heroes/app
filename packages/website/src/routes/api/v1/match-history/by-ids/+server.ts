import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { handle, parseQuery, requireUser } from '$lib/server/http';

const querySchema = z.object({
	ids: z
		.string()
		.transform((value) =>
			value
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean)
		)
		.pipe(z.array(z.string()).min(1).max(100))
});

/** History rows of these lobbies, in the order asked (the games behind a head-to-head record). */
export const GET = handle((event) =>
	requireUser(event)
		.andThen((user) => parseQuery(querySchema, event.url).map((query) => ({ user, ...query })))
		.asyncAndThen(({ user, ids }) =>
			event.locals.services.matchHistory
				.rowsByIds(ids, { id: user.id, isStaff: isStaffUser(user) })
				.map((items) => ({ items }))
		)
);
