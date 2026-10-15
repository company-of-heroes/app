import { handle, parseBody, requireEditor } from '$lib/server/http';
import { guideCategoryInput } from '$lib/server/guide-params';

/** The two-level category tree. */
export const GET = handle((event) => event.locals.services.guides.tree());

/** Editors and staff add a category (top-level, or under a top-level one). */
export const POST = handle((event) =>
	requireEditor(event).asyncAndThen(() =>
		parseBody(guideCategoryInput, event.request).andThen((input) =>
			event.locals.services.guides.createCategory(input)
		)
	)
);
