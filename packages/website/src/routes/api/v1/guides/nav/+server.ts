import { handle, parseQuery } from '$lib/server/http';
import { guideNavQuery } from '$lib/server/guide-params';

/** The category tree and the published guides directly under `categoryId`. */
export const GET = handle((event) =>
	parseQuery(guideNavQuery, event.url).asyncAndThen(({ language, categoryId }) =>
		event.locals.services.guides.nav(language, { categoryId: categoryId ?? null, guideId: null })
	)
);
