import { errAsync } from 'neverthrow';
import { isStaffUser } from '$lib/auth/user';
import { badRequest, unauthorized } from '$lib/server/errors';
import { handle } from '$lib/server/http';

/** `userId` from older clients is ignored: user scope is always the signed-in account. */
export const GET = handle(({ params, locals }) => {
	const scope = params.scope;
	if (scope !== 'user' && scope !== 'community') {
		return errAsync(badRequest('invalid scope'));
	}

	if (scope === 'user' && !locals.user) {
		return errAsync(unauthorized('Sign in to see your matches'));
	}

	const viewer = locals.user ? { id: locals.user.id, isStaff: isStaffUser(locals.user) } : null;
	return locals.services.matchHistory.filterOptions(scope, viewer);
});
