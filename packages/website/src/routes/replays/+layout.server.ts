import { unwrapAsync } from '$lib/errors/unwrap';
import { parseReplaysTab } from '$lib/replays';
import type { LayoutServerLoad } from './$types';

export const prerender = false;

/** Maps only depend on `tab` — keep them out of the page load so filter/page changes do not refetch. */
export const load: LayoutServerLoad = ({ locals, url }) => {
	const tab = parseReplaysTab(url.searchParams);
	const replays = locals.services.replays();

	if (tab === 'member') {
		return { maps: unwrapAsync(replays.getMemberMaps()) };
	}

	if (tab === 'mine') {
		if (!locals.user) {
			return { maps: Promise.resolve([]) };
		}

		return {
			maps: unwrapAsync(
				replays.getMaps({
					scope: 'user',
					userId: locals.user.id
				})
			)
		};
	}

	return { maps: unwrapAsync(replays.getMaps()) };
};
