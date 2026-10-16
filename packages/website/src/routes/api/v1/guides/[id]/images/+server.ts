import { errAsync, okAsync } from 'neverthrow';
import { badRequest } from '$lib/server/errors';
import { handle, readRecordBody, requireUser } from '$lib/server/http';

/** Multipart `file`: an inline image for the guide; answers with its url. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		readRecordBody(event.request)
			.andThen(({ files }) =>
				files.file ? okAsync(files.file) : errAsync(badRequest('Choose an image to upload.'))
			)
			.andThen((file) => event.locals.services.guides.uploadImage(event.params.id!, file, user))
	)
);
