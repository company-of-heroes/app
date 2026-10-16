import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { isPaddlePortalUrl } from '@company-of-heroes/api';
import { z } from 'zod';
import { unwrapAsync } from '$lib/errors/unwrap';

function signedIn() {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Sign in to continue.'));
	}

	return { services: locals.services, user: locals.user };
}

/** The signed-in user's supporter status (a command: polled after the checkout, never cached). */
export const getSupporterStatus = command(() => {
	const { services, user } = signedIn();
	return unwrapAsync(services.subscriptions.status(user.id));
});

/** What Paddle.js needs to open the checkout. */
export const startSupporterCheckout = command(() => {
	const { services, user } = signedIn();
	return unwrapAsync(services.subscriptions.checkout(user.id));
});

/** Paddle customer portal link (cancel, change card). */
export const openSupporterPortal = command(async () => {
	const { services, user } = signedIn();
	const portal = await unwrapAsync(services.subscriptions.portal(user.id));
	if (!isPaddlePortalUrl(portal.url)) {
		error(502, getRequestEvent().locals.t('Something went wrong'));
	}

	return portal;
});

/** Shows or hides the signed-in user on the supporters page (the medal stays). */
export const setSupporterHidden = command(z.boolean(), (hidden) => {
	const { services, user } = signedIn();
	return unwrapAsync(services.subscriptions.setHidden(user.id, hidden));
});
