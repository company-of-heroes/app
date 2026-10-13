import { query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
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
