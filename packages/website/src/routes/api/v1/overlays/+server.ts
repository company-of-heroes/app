import { badRequest } from '$lib/server/errors';
import { handle, readRecordBody, requireUser } from '$lib/server/http';
import { ensure } from '$lib/server/result';

/** Publishes the user's OBS overlay: multipart `bundle` (zip of the built overlay). */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		readRecordBody(event.request).andThen(({ files }) =>
			ensure(files.bundle, badRequest('Missing bundle file')).asyncAndThen(() =>
				event.locals.services.overlays.publish(user.id, files.bundle)
			)
		)
	)
);
