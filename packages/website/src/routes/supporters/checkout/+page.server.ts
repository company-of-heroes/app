import { redirect } from '@sveltejs/kit';
import { loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import { checkoutPaymentId } from '$lib/server/supporter-checkout';
import type { PageServerLoad } from './$types';

export const prerender = false;

/** Where Mollie sends the browser back: the state of the last checkout's payment. */
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (!locals.user) {
		redirect(303, loginRedirectHref(url.pathname, locals.locale));
	}

	return {
		state: await unwrapAsync(
			locals.services.subscriptions.checkoutStatus(locals.user.id, checkoutPaymentId(cookies))
		)
	};
};
