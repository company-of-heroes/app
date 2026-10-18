import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { isMollieCheckoutUrl } from '@company-of-heroes/api';
import { z } from 'zod';
import { unwrapAsync } from '$lib/errors/unwrap';
import { checkoutPaymentId, rememberCheckout } from '$lib/server/supporter-checkout';
import { SUPPORTER_CHECKOUT_OPEN } from '$lib/site/supporter';

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

/** The Mollie checkout link for the first payment; the payment is remembered for the status page. */
export const startSupporterCheckout = command(async () => {
	const { services, user } = signedIn();
	const event = getRequestEvent();
	if (!SUPPORTER_CHECKOUT_OPEN) {
		error(503, event.locals.t('Becoming a supporter is coming soon. Check back in a few days.'));
	}

	const checkout = await unwrapAsync(services.subscriptions.checkout(user.id, event.url.origin));
	if (!isMollieCheckoutUrl(checkout.checkoutUrl)) {
		error(502, event.locals.t('Something went wrong'));
	}

	rememberCheckout(event.cookies, checkout.paymentId);
	return { checkoutUrl: checkout.checkoutUrl };
});

/** The state of the last checkout's payment (polled by the status page while it is pending). */
export const getCheckoutState = command(() => {
	const { services, user } = signedIn();
	const { cookies } = getRequestEvent();
	return unwrapAsync(services.subscriptions.checkoutStatus(user.id, checkoutPaymentId(cookies)));
});

/** Stops the monthly payments; the medal stays until the paid period ends. */
export const cancelSupporter = command(() => {
	const { services, user } = signedIn();
	return unwrapAsync(services.subscriptions.cancel(user.id));
});

/** Undoes a cancel before the paid period ends. */
export const resumeSupporter = command(() => {
	const { services, user } = signedIn();
	return unwrapAsync(services.subscriptions.resume(user.id));
});

/** Shows or hides the signed-in user on the supporters page (the medal stays). */
export const setSupporterHidden = command(z.boolean(), (hidden) => {
	const { services, user } = signedIn();
	return unwrapAsync(services.subscriptions.setHidden(user.id, hidden));
});
