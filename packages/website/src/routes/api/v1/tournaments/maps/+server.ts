import { z } from 'zod';
import { handle, parse, readRecordBody, requireStaff } from '$lib/server/http';

/** Staff-made maps for map pools (built-in maps are a fixed list in `@company-of-heroes/api`). */
export const GET = handle((event) => event.locals.services.tournaments.listMaps());

/** Staff add a map: multipart `name` + optional `icon`. */
export const POST = handle((event) =>
	requireStaff(event).asyncAndThen((staff) =>
		readRecordBody(event.request).andThen(({ data, files }) =>
			parse(z.object({ name: z.string().max(80) }), data).asyncAndThen(({ name }) =>
				event.locals.services.tournaments.createMap(name, files.icon ?? null, staff.id)
			)
		)
	)
);
