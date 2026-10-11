import { err, ok } from 'neverthrow';
import { reportDocsIssueSchema, wikiUrl } from '$lib/server/docs/input';
import { badRequest } from '$lib/server/errors';
import { handle, parseBody, requireUser } from '$lib/server/http';
import { SITE_URL } from '$lib/site/urls';

/** Signed in (the desktop app): reports wrong info on a wiki page; staff get a notification. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(reportDocsIssueSchema, event.request)
			.andThen(({ path, page, description }) => {
				const url = wikiUrl(path, SITE_URL);
				return url ? ok({ url, page, description }) : err(badRequest('This is not a wiki page.'));
			})
			.andThen((input) => event.locals.services.docs.report({ ...input, reporterId: user.id }))
	)
);
