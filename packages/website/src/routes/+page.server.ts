import type { ResultAsync } from 'neverthrow';
import type { AppError } from '$lib/errors/app-error';
import {
	HOME_RECENT_MATCHES,
	HOME_RECENT_MEMBER_UPLOADS,
	recentCommunityQuery,
	recentMemberQuery
} from '$lib/replays';
import type { PageServerLoad } from './$types';

export const prerender = false;

type SectionResult<T> = {
	items: T[];
	error: string | null;
};

async function loadSection<T>(result: ResultAsync<T[], AppError>): Promise<SectionResult<T>> {
	const settled = await result;
	if (settled.isErr()) {
		return { items: [], error: settled.error.message };
	}

	return { items: settled.value, error: null };
}

export const load: PageServerLoad = async ({ locals }) => {
	// Auth chrome lives in the root layout; do not public-cache this HTML.
	// Shared caches ignore Vary: Cookie and would keep serving the anonymous shell.
	const replays = locals.services.replays();
	const [liveLobbies, recentMatches, recentMemberUploads, streams] = await Promise.all([
		loadSection(locals.services.liveLobbies().list()),
		loadSection(
			replays.getHistory(recentCommunityQuery(), HOME_RECENT_MATCHES).map((list) => list.items)
		),
		loadSection(
			replays
				.getMemberHistory(recentMemberQuery(), HOME_RECENT_MEMBER_UPLOADS)
				.map((list) => list.items)
		),
		locals.services.twitch().listStreams().unwrapOr([])
	]);

	return { liveLobbies, recentMatches, recentMemberUploads, streams };
};
