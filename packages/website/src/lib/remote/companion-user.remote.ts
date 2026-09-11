import { query, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { unwrapAsync } from '$lib/errors/unwrap';

export const getCompanionUser = query(v.pipe(v.string(), v.minLength(1)), (steamId) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.auth().findCompanionBySteamId(steamId));
});
