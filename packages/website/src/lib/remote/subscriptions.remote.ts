import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
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
export const openSupporterPortal = command(() => {
	const { services, user } = signedIn();
	return unwrapAsync(services.subscriptions.portal(user.id));
});
