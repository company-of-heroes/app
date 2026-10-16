import { z } from 'zod';
import { handle, parse, readRecordBody, requireHost } from '$lib/server/http';

/** Uploaded champion medals (built-in medals ship with the hosts). */
export const GET = handle((event) => event.locals.services.tournaments.listMedals());

/** Staff and hosts upload a medal: multipart `name` + `image` (PNG or SVG). */
export const POST = handle((event) =>
	requireHost(event).asyncAndThen((user) =>
		readRecordBody(event.request).andThen(({ data, files }) =>
			parse(z.object({ name: z.string().max(80) }), data).asyncAndThen(({ name }) =>
				event.locals.services.tournaments.createMedal(name, files.image ?? null, user.id)
			)
		)
	)
);
