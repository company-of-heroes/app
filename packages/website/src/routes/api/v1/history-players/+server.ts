import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { handle, parseQuery } from '$lib/server/http';

const querySchema = z.object({
	scope: z.enum(['user', 'community']).catch('community'),
	q: z.string().max(100).catch(''),
	limit: z.coerce.number().int().min(1).max(50).catch(20)
});

export const GET = handle(({ url, locals, setHeaders }) =>
	parseQuery(querySchema, url).asyncAndThen(({ scope, q, limit }) => {
		const viewer = locals.user ? { id: locals.user.id, isStaff: isStaffUser(locals.user) } : null;
		return locals.services.matchHistory.searchPlayers(scope, q, limit, viewer).map((items) => {
			setHeaders({
				'cache-control': scope === 'community' ? 'public, max-age=60' : 'private, max-age=30'
			});
			return { items };
		});
	})
);
