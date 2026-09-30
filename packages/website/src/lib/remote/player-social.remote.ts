import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { unwrapAsync } from '$lib/errors/unwrap';

const steamId = z.string().min(1);

export const getMyPlayerVote = query(steamId, (id) => {
	return unwrapAsync(getRequestEvent().locals.api.playerSocial.getMyVote(id));
});

/** Voting the same way twice removes the vote. */
export const setPlayerVote = command(
	z.object({ steamId, value: z.union([z.literal(1), z.literal(-1)]) }),
	async ({ steamId, value }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) {
			error(401, locals.t('Sign in to do that.'));
		}

		const result = await unwrapAsync(
			locals.services.playerSocial.vote(steamId, locals.user.id, value, { toggle: true })
		);
		return { vote: result.vote, likeCount: result.likeCount };
	}
);
