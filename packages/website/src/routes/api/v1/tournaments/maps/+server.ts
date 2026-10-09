import { z } from 'zod';
import { handle, parse, readRecordBody, requireHost } from '$lib/server/http';

/** Staff-made maps for map pools (built-in maps are a fixed list in `@company-of-heroes/api`). */
export const GET = handle((event) => event.locals.services.tournaments.listMaps());

/** Staff and hosts add a map: multipart `name` + optional `icon`. */
export const POST = handle((event) =>
	requireHost(event).asyncAndThen((user) =>
		readRecordBody(event.request).andThen(({ data, files }) =>
			parse(z.object({ name: z.string().max(80) }), data).asyncAndThen(({ name }) =>
				event.locals.services.tournaments.createMap(name, files.icon ?? null, user.id)
			)
		)
	)
);
