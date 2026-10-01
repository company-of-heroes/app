import { z } from 'zod';
import { handle, parseBody, requireUser } from '$lib/server/http';

const body = z.object({ steamId: z.string().regex(/^7656119\d{10}$/, 'Invalid Steam id') });

/** Links a Steam id the desktop app saw in the game log; 409 when another account owns it. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(body, event.request).andThen(({ steamId }) =>
			event.locals.services.users.linkSteamId(user.id, steamId)
		)
	)
);
