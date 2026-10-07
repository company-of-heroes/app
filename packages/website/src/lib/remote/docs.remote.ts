import { command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import { DOCS_NOTE_MAX, DOCS_REPORT_MAX } from '$lib/server/services/docs';

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

const reportDocsIssueSchema = z.object({
	/** Path (with search) of the wiki page, e.g. `/es/wiki/units/riflemen`. */
	path: z.string().max(300),
	page: z.string().max(200),
	description: z.string().trim().min(1).max(DOCS_REPORT_MAX)
});

const WIKI_PATH = /^(\/(es|ko))?\/wiki(\/[a-z0-9-]+)*\/?$/;

/** Signed-in users report wrong info on a wiki page; staff get a notification. */
export const reportDocsIssue = command(
	reportDocsIssueSchema,
	async ({ path, page, description }) => {
		const { locals, url } = getRequestEvent();
		if (!locals.user) {
			error(401, locals.t('Sign in to report an issue.'));
		}

		const target = new URL(path, url.origin);
		if (target.origin !== url.origin || !WIKI_PATH.test(target.pathname)) {
			error(400, locals.t('This is not a wiki page.'));
		}

		return unwrapAsync(
			locals.services.docs.report({
				url: `${target.origin}${target.pathname}${target.search}`,
				page,
				description,
				reporterId: locals.user.id
			})
		);
	}
);
