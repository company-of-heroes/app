import { handle, parseQuery } from '$lib/server/http';
import { guideResolveQuery } from '$lib/server/guide-params';

/** What `/guides/<path>` shows in a language (the desktop app's guide pages). */
export const GET = handle((event) =>
	parseQuery(guideResolveQuery, event.url).asyncAndThen(({ path, language, page }) =>
		event.locals.services.guides.resolve(
			path.split('/').filter(Boolean),
			language,
			event.locals.user ?? null,
			page
		)
	)
);
