import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { unwrapAsync } from '$lib/errors/unwrap';

/** Commands, not queries: the bell always wants fresh data, never a cached read. */
function signedIn() {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Log in to do that.'));
	}

	return { services: locals.services, user: locals.user };
}

export const listNotifications = command(async () => {
	const { services, user } = signedIn();
	return unwrapAsync(services.notifications.list(user));
});

export const unreadNotifications = command(async () => {
	const { services, user } = signedIn();
	return unwrapAsync(services.notifications.unreadCount(user));
});

export const markNotificationRead = command(z.string().regex(/^[a-z0-9]{15}$/), async (id) => {
	const { services, user } = signedIn();
	await unwrapAsync(services.notifications.markRead(user, id));
});
