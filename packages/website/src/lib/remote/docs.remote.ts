import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import { reportDocsIssueSchema, saveDocsNoteSchema, wikiUrl } from '$lib/server/docs/input';

/** Staff only: tips are shown to everyone on the docs pages. */
export const saveDocsNote = command(saveDocsNoteSchema, async ({ kind, slug, body }) => {
	const { locals } = getRequestEvent();
	if (!locals.user || !isStaffUser(locals.user)) {
		error(403, locals.t('Only staff can do that.'));
	}

	return unwrapAsync(locals.services.docs.saveNote(kind, slug, body, locals.user.id));
});

/** Signed-in users report wrong info on a wiki page; staff get a notification. */
export const reportDocsIssue = command(
	reportDocsIssueSchema,
	async ({ path, page, description }) => {
		const { locals, url } = getRequestEvent();
		if (!locals.user) {
			error(401, locals.t('Sign in to report an issue.'));
		}

		const target = wikiUrl(path, url.origin);
		if (!target) {
			error(400, locals.t('This is not a wiki page.'));
		}

		return unwrapAsync(
			locals.services.docs.report({
				url: target,
				page,
				description,
				reporterId: locals.user.id
			})
		);
	}
);
