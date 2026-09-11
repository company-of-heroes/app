import { command, getRequestEvent, query } from '$app/server';
import * as v from 'valibot';
import { unwrapAsync } from '$lib/errors/unwrap';

const steamIdSchema = v.pipe(v.string(), v.minLength(1));

export const getMyPlayerVote = query(steamIdSchema, (steamId) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.playerSocial().getMyVote(steamId));
});

export const setPlayerVote = command(
	v.object({
		steamId: steamIdSchema,
		value: v.union([v.literal(1), v.literal(-1)])
	}),
	({ steamId, value }) => {
		const { locals } = getRequestEvent();
		return unwrapAsync(locals.services.playerSocial().setPlayerVote(steamId, value));
	}
);
