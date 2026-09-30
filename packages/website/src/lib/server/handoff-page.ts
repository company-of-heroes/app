import { redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { localizeHref, safeInternalPath } from '@company-of-heroes/i18n';

/** Older app builds sent the code base64url-encoded in the link. */
function decodeWire(wire: string): string {
	if (
		wire.startsWith('signed-v1.') ||
		wire.includes('|') ||
		!(wire.length > 40 && /^[A-Za-z0-9_-]+$/.test(wire))
	) {
		return wire;
	}

	const base64 =
		wire.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (wire.length % 4)) % 4);
	return atob(base64);
}

/**
 * /auth/handoff (from the desktop app) and /auth/steam (after Steam login): redeem
 * the login code, sign the browser in (the handle hook writes the cookie) and continue.
 */
export async function redeemLoginCode({ url, locals }: ServerLoadEvent): Promise<never> {
	const login = localizeHref('/login', locals.locale);
	const error = url.searchParams.get('error');
	if (error) {
		redirect(303, `${login}?error=${encodeURIComponent(error)}`);
	}

	const code = url.searchParams.get('code');
	if (!code) {
		redirect(303, login);
	}

	const session = await locals.services.auth.exchangeHandoff(decodeWire(code));
	if (session.isErr()) {
		const message =
			session.error.status === 500 ? 'Invalid or expired login link.' : session.error.message;
		redirect(303, `${login}?error=${encodeURIComponent(locals.t(message))}`);
	}

	locals.pocketbase.authStore.save(session.value.token, session.value.record);
	redirect(303, safeInternalPath(url.searchParams.get('redirect'), locals.locale));
}
