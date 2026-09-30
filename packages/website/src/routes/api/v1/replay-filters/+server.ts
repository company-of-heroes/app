import { handle, requireUser } from '$lib/server/http';

/** Filter options over the signed-in user's own uploads (`userId` from older clients is ignored). */
export const GET = handle((event) =>
	requireUser(event).asyncAndThen((user) => {
		event.setHeaders({ 'cache-control': 'private, no-store' });
		return event.locals.services.memberReplays.ownFilterOptions(user.id);
	})
);
