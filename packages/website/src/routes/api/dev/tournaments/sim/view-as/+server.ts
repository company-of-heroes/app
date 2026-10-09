import { dev } from '$app/environment';
import type { RequestEvent } from '@sveltejs/kit';
import { err, errAsync, ok, okAsync } from 'neverthrow';
import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { badRequest, forbidden, notFound } from '$lib/server/errors';
import { handle, parseBody, requireUser } from '$lib/server/http';
import { fromPb } from '$lib/server/result';
import { SIM_RETURN_COOKIE } from '$lib/server/services/dev-tournament-sim';

/**
 * Local development only: staff look at the site (and the bell, popups and "my tournament")
 * as one of the simulator's bots. The staff session waits in its own cookie; the handle hook
 * writes `pb_auth` from the auth store, as after a normal login.
 */
const bodySchema = z.object({ userId: z.string().min(1) });

/** The user id inside a PocketBase token (only read to compare; the token is refreshed on return). */
function tokenUserId(token: string): string | null {
	try {
		const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
		return typeof payload.id === 'string' ? payload.id : null;
	} catch {
		return null;
	}
}

function cookieOptions(event: RequestEvent) {
	return {
		httpOnly: true,
		secure: event.url.protocol === 'https:',
		sameSite: 'lax' as const,
		path: '/',
		maxAge: 24 * 60 * 60
	};
}

/** Signs the browser back in as the staff member who started viewing. */
function restore(event: RequestEvent, token: string) {
	const pocketbase = event.locals.pocketbase;
	pocketbase.authStore.save(token, null);
	return fromPb(
		pocketbase.collection('users').authRefresh(),
		'Your staff session expired. Log in again.'
	)
		.map(() => {
			event.cookies.delete(SIM_RETURN_COOKIE, { path: '/' });
			return { userId: pocketbase.authStore.record?.id ?? null };
		})
		.orElse((error) => {
			pocketbase.authStore.clear();
			event.cookies.delete(SIM_RETURN_COOKIE, { path: '/' });
			return errAsync(error);
		});
}

export const POST = handle((event) => {
	if (!dev) {
		return err(notFound('Not found'));
	}

	const returnToken = event.cookies.get(SIM_RETURN_COOKIE) ?? null;
	return requireUser(event)
		.andThen((user) => {
			if (returnToken) {
				return ok({ staffId: tokenUserId(returnToken), saved: returnToken });
			}

			return isStaffUser(user)
				? ok({ staffId: user.id, saved: event.locals.pocketbase.authStore.token })
				: err(forbidden('Only staff can do that.'));
		})
		.asyncAndThen(({ staffId, saved }) =>
			parseBody(bodySchema, event.request).andThen(({ userId }) => {
				if (userId === staffId) {
					return returnToken ? restore(event, returnToken) : okAsync({ userId });
				}

				return event.locals.services.devTournamentSim
					.isBot(userId)
					.andThen((bot) =>
						bot
							? event.locals.services.auth.session(userId)
							: errAsync(badRequest('Only simulator bots.'))
					)
					.map((session) => {
						event.locals.pocketbase.authStore.save(session.token, session.record);
						event.cookies.set(SIM_RETURN_COOKIE, saved, cookieOptions(event));
						return { userId };
					});
			})
		);
});

export const DELETE = handle((event) => {
	if (!dev) {
		return err(notFound('Not found'));
	}

	const returnToken = event.cookies.get(SIM_RETURN_COOKIE);
	return returnToken
		? restore(event, returnToken)
		: errAsync(badRequest('You are not viewing as a bot.'));
});
