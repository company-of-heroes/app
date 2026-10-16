import { handle, parseQuery, requireUser } from '$lib/server/http';
import { guideTranslationsQuery } from '$lib/server/guide-params';

/** Published guides in other languages, by title, for the translation picker. */
export const GET = handle((event) =>
	requireUser(event).asyncAndThen(() =>
		parseQuery(guideTranslationsQuery, event.url).asyncAndThen(({ language, q }) =>
			event.locals.services.guides.searchTranslations(language, q)
		)
	)
);
