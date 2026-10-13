import { query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';

/** Signed-in user's head-to-head record against each requested profile id. */
export const getHeadToHead = query(
	z.object({ profileIds: z.array(z.number().int().positive()).min(1).max(16) }),
	async ({ profileIds }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) {
			error(401, locals.t('Log in to do that.'));
		}

		return unwrapAsync(locals.services.headToHead.forUser(locals.user.id, null, profileIds));
	}
);

/** History rows of the games behind a head-to-head record (the user's own lobbies). */
export const getHeadToHeadMatches = query(
	z.object({ lobbyIds: z.array(z.string().min(1)).min(1).max(100) }),
	async ({ lobbyIds }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) {
			error(401, locals.t('Log in to do that.'));
		}

		return unwrapAsync(
			locals.services.matchHistory.rowsByIds(lobbyIds, {
				id: locals.user.id,
				isStaff: isStaffUser(locals.user)
			})
		);
	}
);
