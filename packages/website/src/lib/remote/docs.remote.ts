import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import { DOCS_NOTE_MAX } from '$lib/server/services/docs';

const saveDocsNoteSchema = z.object({
	kind: z.enum(['unit', 'building', 'commander', 'weapon']),
	slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
	body: z.string().max(DOCS_NOTE_MAX)
});

/** Staff only: tips are shown to everyone on the docs pages. */
export const saveDocsNote = command(saveDocsNoteSchema, async ({ kind, slug, body }) => {
	const { locals } = getRequestEvent();
	if (!locals.user || !isStaffUser(locals.user)) {
		error(403, locals.t('Only staff can do that.'));
	}

	return unwrapAsync(locals.services.docs.saveNote(kind, slug, body, locals.user.id));
});
