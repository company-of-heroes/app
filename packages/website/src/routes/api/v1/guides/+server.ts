import { handle, parseBody, parseQuery, requireUser } from '$lib/server/http';
import { guideCreateBody, guideListQuery } from '$lib/server/guide-params';

/** Published guides in a language, newest first; `categoryId` includes its subcategories. */
export const GET = handle((event) =>
	parseQuery(guideListQuery, event.url).asyncAndThen((query) =>
		event.locals.services.guides.list(query)
	)
);

/** Any signed-in user starts an empty draft; editors and staff publish it. */
export const POST = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(guideCreateBody, event.request).andThen(({ language }) =>
			event.locals.services.guides.create(user, language)
		)
	)
);
