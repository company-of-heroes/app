import { isStaffUser } from '$lib/auth/user';
import { handle } from '$lib/server/http';

export const GET = handle(({ params, locals, setHeaders }) => {
	const user = locals.user;
	return locals.services.matches
		.get(params.id ?? '', user ? { id: user.id, isStaff: isStaffUser(user) } : null)
		.map((match) => {
			// Signed-in responses carry `canPublish` (and staff fields): never share-cache them.
			setHeaders({
				'cache-control': user
					? 'private, no-store'
					: 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
			});
			return match;
		});
});
