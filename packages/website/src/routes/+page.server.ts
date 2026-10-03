import {
	HOME_RECENT_MATCHES,
	HOME_RECENT_MEMBER_UPLOADS,
	recentCommunityQuery,
	recentMemberQuery,
	TOP_REPLAYS,
	TOP_REPLAYS_DAYS
} from '$lib/replays';
import type { Task } from '$lib/server/result';
import { historyInputFromQuery } from '$lib/server/services/match-history';
import { memberQueryFromReplaysQuery } from '$lib/server/services/member-replays';
import type { PageServerLoad } from './$types';

export const prerender = false;

type SectionResult<T> = {
	items: T[];
	error: string | null;
};

/** A home page section: its items, or the error message to show in its place. */
function section<T>(items: Task<T[]>): Promise<SectionResult<T>> {
	return items.match(
		(list) => ({ items: list, error: null }),
		(error) => ({ items: [], error: error.message })
	);
}

/** Stream each section so client nav to `/` is not blocked on Twitch / match APIs. */
export const load: PageServerLoad = ({ locals }) => {
	return {
		liveLobbies: section(locals.services.liveLobbies.list()),
		topReplays: section(
			locals.services.replays.top({ days: TOP_REPLAYS_DAYS, limit: TOP_REPLAYS })
		),
		recentMatches: section(
			locals.services.matchHistory
				.list(historyInputFromQuery(recentCommunityQuery(), 'community', HOME_RECENT_MATCHES), null)
				.map((list) => list.items)
		),
		recentMemberUploads: section(
			locals.services.memberReplays
				.list(memberQueryFromReplaysQuery(recentMemberQuery(), HOME_RECENT_MEMBER_UPLOADS), null)
				.map((list) => list.items)
		),
		streams: locals.services.twitch.listStreams().unwrapOr([])
	};
};
