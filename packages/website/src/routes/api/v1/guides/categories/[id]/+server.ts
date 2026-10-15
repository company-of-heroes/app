import { handle, parseBody, requireStaff } from '$lib/server/http';
import { guideCategoryUpdate } from '$lib/server/guide-params';

/** Staff rename, re-address or reorder a category. */
export const PATCH = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		parseBody(guideCategoryUpdate, event.request).andThen((input) =>
			event.locals.services.guides.updateCategory(event.params.id!, input)
		)
	)
);

/** Staff delete an empty category. */
export const DELETE = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		event.locals.services.guides.deleteCategory(event.params.id!).map(() => ({ ok: true }))
	)
);
