import { z } from 'zod';
import { handle, parseBody, requireUser } from '$lib/server/http';

const body = z.object({ steamId: z.string().regex(/^7656119\d{10}$/, 'Invalid Steam id') });

/** Makes one of the account's linked Steam ids the main one (it shows the account rewards). */
export const PUT = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(body, event.request).andThen(({ steamId }) =>
			event.locals.services.users.setMainSteamId(user.id, steamId)
		)
	)
);
