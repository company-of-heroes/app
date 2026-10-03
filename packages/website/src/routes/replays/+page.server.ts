import {
	parseReplaysQuery,
	parseReplaysTab,
	REPLAYS_PER_PAGE,
	TOP_REPLAYS,
	TOP_REPLAYS_DAYS
} from '$lib/replays';
import { isStaffUser, loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import { historyInputFromQuery } from '$lib/server/services/match-history';
import { memberQueryFromReplaysQuery } from '$lib/server/services/member-replays';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals, url }) => {
	const tab = parseReplaysTab(url.searchParams);
	if (tab === 'mine' && !locals.user) {
		redirect(303, loginRedirectHref(url.pathname + url.search, locals.locale));
	}

	const query = parseReplaysQuery(url.searchParams);
	const viewer = locals.user ? { id: locals.user.id, isStaff: isStaffUser(locals.user) } : null;
	// Spotlight on the unfiltered first page of the public tabs only.
	const unfiltered =
		query.filter == null && !query.ranked && query.maps.length === 0 && !query.playerIds.length;
	const topReplays =
		tab !== 'mine' && query.page === 1 && unfiltered
			? locals.services.replays.top({ days: TOP_REPLAYS_DAYS, limit: TOP_REPLAYS }).unwrapOr([])
			: null;

	if (tab === 'member') {
		return {
			tab,
			query,
			topReplays,
			result: unwrapAsync(
				locals.services.memberReplays.list(
					memberQueryFromReplaysQuery(query, REPLAYS_PER_PAGE),
					viewer
				)
			)
		};
	}

	const input = historyInputFromQuery(
		query,
		tab === 'mine' ? 'user' : 'community',
		REPLAYS_PER_PAGE
	);
	return {
		tab,
		query,
		topReplays,
		result: unwrapAsync(locals.services.matchHistory.list(input, viewer))
	};
};
