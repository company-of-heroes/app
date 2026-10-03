import { isStaffUser } from '$lib/auth/user';
import { handle } from '$lib/server/http';

/** A community match or member replay by id, so clients need one request instead of two. */
export const GET = handle(({ params, locals, setHeaders }) => {
	const user = locals.user;
	return locals.services.replays
		.getAny(params.id ?? '', user ? { id: user.id, isStaff: isStaffUser(user) } : null)
		.map((replay) => {
			// Signed-in match responses carry `canPublish` (and staff fields): never share-cache them.
			const shared = !user && !(replay.kind === 'member' && replay.visibility === 'deleted');
			setHeaders({
				'cache-control': shared
					? 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
					: 'private, no-store'
			});
			return replay;
		});
});
