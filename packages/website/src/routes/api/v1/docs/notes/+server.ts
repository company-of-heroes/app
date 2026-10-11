import { saveDocsNoteSchema } from '$lib/server/docs/input';
import { handle, parseBody, requireStaff } from '$lib/server/http';

/** Staff only: saves (or with an empty body removes) the tip of a wiki page. */
export const POST = handle((event) =>
	requireStaff(event).asyncAndThen((user) =>
		parseBody(saveDocsNoteSchema, event.request).andThen(({ kind, slug, body }) =>
			event.locals.services.docs.saveNote(kind, slug, body, user.id)
		)
	)
);
