import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';

const sessionId = z.number().int().min(1);

/** Staff only: hiding changes what everyone else can see. */
function staff() {
	const { locals } = getRequestEvent();
	if (!locals.user || !isStaffUser(locals.user)) {
		error(403, locals.t('Only staff can do that.'));
	}

	return { services: locals.services, user: locals.user };
}

export const getHiddenMatch = query(sessionId, (id) =>
	unwrapAsync(getRequestEvent().locals.services.hiddenMatches.isSessionHidden(id))
);

export const hideMatch = command(sessionId, async (id) => {
	const { services, user } = staff();
	await unwrapAsync(services.hiddenMatches.hide(id, user.id));
	getHiddenMatch(id).set(true);
});

export const unhideMatch = command(sessionId, async (id) => {
	const { services } = staff();
	await unwrapAsync(services.hiddenMatches.unhide(id));
	getHiddenMatch(id).set(false);
});
