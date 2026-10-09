import type { RequestEvent } from '@sveltejs/kit';
import type { AuthUserPublic } from '$lib/auth/user';
import { requireUser } from './http';
import type { Task } from './result';

/**
 * Staff actions on the tournament in `params.id`: staff, or the community host who created it.
 * Resolves the id (the route may get a slug).
 */
export function requireManager(event: RequestEvent): Task<{ user: AuthUserPublic; id: string }> {
	return requireUser(event).asyncAndThen((user) =>
		event.locals.services.tournaments
			.managed(event.params.id ?? '', user)
			.map((id) => ({ user, id }))
	);
}
