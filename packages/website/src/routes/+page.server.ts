import { okAsync, ResultAsync } from 'neverthrow';
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
	const liveLobbies = locals.services.liveLobbies.list();
	const memberUploads = locals.services.memberReplays.list(
		memberQueryFromReplaysQuery(recentMemberQuery(), HOME_RECENT_MEMBER_UPLOADS),
		null
	);
	return {
		liveLobbies: section(liveLobbies),
		topReplays: section(
			locals.services.replays.top({ days: TOP_REPLAYS_DAYS, limit: TOP_REPLAYS })
		),
		recentMatches: section(
			locals.services.matchHistory
				.list(historyInputFromQuery(recentCommunityQuery(), 'community', HOME_RECENT_MATCHES), null)
				.map((list) => list.items)
		),
		recentMemberUploads: section(memberUploads.map((list) => list.items)),
		statistics: ResultAsync.combine([
			locals.services.statistics.get({ period: '30' }),
			locals.services.statistics.totals(),
			liveLobbies.map((lobbies) => lobbies.length).orElse(() => okAsync(0)),
			memberUploads.map((list) => list.totalItems).orElse(() => okAsync(0))
		]).match(
			([stats, totals, liveNow, replaysUploaded]) => ({
				stats,
				headline: { ...totals, liveNow, replaysUploaded }
			}),
			() => null
		),
		streams: locals.services.twitch.listStreams().unwrapOr([]),
		// Public lists only (no staff drafts), so the home page looks the same for everyone.
		tournaments: ResultAsync.combine([
			locals.services.tournaments.list('active', false),
			locals.services.tournaments.list('upcoming', false)
		]).match(
			([active, upcoming]) => ({ active, upcoming }),
			() => ({ active: [], upcoming: [] })
		)
	};
};
