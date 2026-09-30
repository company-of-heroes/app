import { badRequest } from '$lib/server/errors';
import { handle, readRecordBody, requireUser } from '$lib/server/http';
import { ensure } from '$lib/server/result';

/** A participant attaches their replay (multipart `file` + `durationSeconds`); the longer or larger one is kept. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		readRecordBody(event.request).andThen(({ data, files }) =>
			ensure(files.file, badRequest('Replay file is required.')).asyncAndThen(() =>
				event.locals.services.lobbies.attachReplay(event.params.id ?? '', user.id, {
					file: files.file,
					seconds: Number(data.durationSeconds) || 0
				})
			)
		)
	)
);
