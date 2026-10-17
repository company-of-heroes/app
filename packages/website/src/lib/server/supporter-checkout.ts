import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';

/** The Mollie payment of the last checkout, so `/supporters/checkout` knows what to show. */
const COOKIE = 'supporter_payment';

export function rememberCheckout(cookies: Cookies, paymentId: string): void {
	cookies.set(COOKIE, paymentId, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		// Lax: the cookie comes along when Mollie sends the browser back (a top-level GET).
		sameSite: 'lax',
		maxAge: 60 * 60
	});
}

export function checkoutPaymentId(cookies: Cookies): string {
	return cookies.get(COOKIE) ?? '';
}
