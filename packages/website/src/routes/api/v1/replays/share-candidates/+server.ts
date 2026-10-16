import { isStaffUser } from '$lib/auth/user';
import { handle, requireUser } from '$lib/server/http';

/** The viewer's recent games with a replay that nobody has shared yet. */
export const GET = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.replays
			.shareCandidates({ id: user.id, isStaff: isStaffUser(user) })
			.map((items) => {
				event.setHeaders({ 'cache-control': 'private, no-store' });
				return { items };
			})
	)
);
