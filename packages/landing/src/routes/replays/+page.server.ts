import { unwrapAsync } from '$lib/errors/unwrap';
import { parseReplaysQuery, parseReplaysTab } from '$lib/replays';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals, url }) => {
	const tab = parseReplaysTab(url.searchParams);
	if (tab === 'mine' && !locals.user) {
		redirect(303, `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
	}

	const query = parseReplaysQuery(url.searchParams);
	const replays = locals.services.replays();

	if (tab === 'member') {
		return {
			tab,
			query,
			result: unwrapAsync(replays.getMemberHistory(query))
		};
	}

	if (tab === 'mine') {
		return {
			tab,
			query,
			result: unwrapAsync(
				replays.getHistory(query, undefined, {
					scope: 'user',
					userId: locals.user!.id
				})
			)
		};
	}

	return {
		tab,
		query,
		result: unwrapAsync(replays.getHistory(query))
	};
};
