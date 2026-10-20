import {
	parseReplaysLayout,
	parseReplaysQuery,
	parseReplaysTab,
	REPLAYS_LAYOUT_COOKIE,
	REPLAYS_PER_PAGE
} from '$lib/replays';
import { isStaffUser, loginRedirectHref } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';
import { ResultAsync } from 'neverthrow';
import type { HistoryMatchup } from '@company-of-heroes/ui/replay';
import { historyInputFromQuery } from '$lib/server/services/match-history';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const prerender = false;

const MATCHUPS: HistoryMatchup[] = ['1v1', '2v2', '3v3', '4v4'];
/** Cards per game type in the grouped community view. */
const GROUP_SIZE = 12;

export const load: PageServerLoad = ({ locals, url, cookies }) => {
	const tab = parseReplaysTab(url.searchParams);
	if (tab === 'mine' && !locals.user) {
		redirect(303, loginRedirectHref(url.pathname + url.search, locals.locale));
	}

	const query = parseReplaysQuery(url.searchParams);
	const layout = parseReplaysLayout(cookies.get(REPLAYS_LAYOUT_COOKIE));
	const viewer = locals.user ? { id: locals.user.id, isStaff: isStaffUser(locals.user) } : null;

	if (tab === 'discover') {
		return {
			tab,
			query,
			layout,
			discover: unwrapAsync(locals.services.replays.discover()),
			// Suggestions are a nicety: a failure just hides the strip.
			shareCandidates: viewer
				? locals.services.replays.shareCandidates(viewer).unwrapOr([])
				: Promise.resolve(null),
			groups: null,
			result: null
		};
	}

	// The unfiltered first page of Community matches: one grid per game type (cards only).
	if (
		layout === 'grid' &&
		tab === 'community' &&
		query.page === 1 &&
		query.matchups.length === 0 &&
		!query.filter
	) {
		return {
			tab,
			query,
			layout,
			discover: null,
			shareCandidates: Promise.resolve(null),
			groups: unwrapAsync(
				ResultAsync.combine(
					MATCHUPS.map((matchup) =>
						locals.services.matchHistory
							.list(
								historyInputFromQuery({ ...query, matchups: [matchup] }, 'community', GROUP_SIZE),
								viewer
							)
							.map((page) => ({ matchup, items: page.items }))
					)
				)
			),
			result: null
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
		layout,
		discover: null,
		shareCandidates: Promise.resolve(null),
		groups: null,
		result: unwrapAsync(locals.services.matchHistory.list(input, viewer))
	};
};
