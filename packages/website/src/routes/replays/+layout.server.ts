import { parseReplaysTab } from '$lib/replays';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { LayoutServerLoad } from './$types';

export const prerender = false;

/** Maps only depend on `tab` — keep them out of the page load so filter/page changes do not refetch. */
export const load: LayoutServerLoad = ({ locals, url }) => {
	const tab = parseReplaysTab(url.searchParams);

	if (tab === 'member') {
		return { maps: unwrapAsync(locals.services.memberReplays.maps()) };
	}

	if (tab === 'mine' && !locals.user) {
		return { maps: Promise.resolve([]) };
	}

	const viewer = locals.user ? { id: locals.user.id, isStaff: false } : null;
	return {
		maps: unwrapAsync(
			locals.services.matchHistory.searchMaps(
				tab === 'mine' ? 'user' : 'community',
				'',
				200,
				viewer
			)
		)
	};
};
