import { handle, parse, readRecordBody, requireUser } from '$lib/server/http';
import { guideImagesFrom, guideInput } from '$lib/server/guide-params';

/** A guide by id: published ones for everyone, drafts for whoever may edit them. */
export const GET = handle((event) =>
	event.locals.services.guides.get(event.params.id!, event.locals.user ?? null)
);

/** JSON, or multipart with `cover`; the service checks the viewer may edit this guide. */
export const PATCH = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		readRecordBody(event.request).andThen(({ data, files }) =>
			parse(guideInput, data).asyncAndThen((input) =>
				event.locals.services.guides.update(
					event.params.id!,
					input,
					guideImagesFrom(data, files),
					user
				)
			)
		)
	)
);

export const DELETE = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.guides.remove(event.params.id!, user).map(() => ({ ok: true }))
	)
);
