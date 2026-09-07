import {
	HOME_RECENT_MATCHES,
	HOME_RECENT_MEMBER_UPLOADS,
	recentCommunityQuery,
	recentMemberQuery
} from '$lib/replays';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals }) => {
	// Auth chrome lives in the root layout; do not public-cache this HTML.
	// Shared caches ignore Vary: Cookie and would keep serving the anonymous shell.
	const replays = locals.services.replays();
	const liveLobbies = locals.services.liveLobbies().list().unwrapOr([]);
	void liveLobbies.catch(() => {});
	const [recentMatches, recentMemberUploads, streams] = await Promise.all([
		replays
			.getHistory(recentCommunityQuery(), HOME_RECENT_MATCHES)
			.map((list) => list.items)
			.unwrapOr([]),
		replays
			.getMemberHistory(recentMemberQuery(), HOME_RECENT_MEMBER_UPLOADS)
			.map((list) => list.items)
			.unwrapOr([]),
		locals.services.twitch().listStreams().unwrapOr([])
	]);

	return { liveLobbies, recentMatches, recentMemberUploads, streams };
};
