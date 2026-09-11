import { command, getRequestEvent, query } from '$app/server';
import * as v from 'valibot';
import { unwrapAsync } from '$lib/errors/unwrap';

const sessionIdSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

export const getHiddenMatch = query(sessionIdSchema, (sessionId) => {
	const { locals } = getRequestEvent();
	return unwrapAsync(locals.services.hiddenMatches().isHidden(sessionId));
});

export const hideMatch = command(sessionIdSchema, async (sessionId) => {
	const { locals } = getRequestEvent();
	await unwrapAsync(locals.services.hiddenMatches().hide(sessionId));
	getHiddenMatch(sessionId).set(true);
});

export const unhideMatch = command(sessionIdSchema, async (sessionId) => {
	const { locals } = getRequestEvent();
	await unwrapAsync(locals.services.hiddenMatches().unhide(sessionId));
	getHiddenMatch(sessionId).set(false);
});
