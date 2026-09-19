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

/** Stream each section so client nav to `/` is not blocked on Twitch / match APIs. */
export const load: PageServerLoad = ({ locals }) => {
	const replays = locals.services.replays();

	return {
		liveLobbies: loadSection(locals.services.liveLobbies().list()),
		recentMatches: loadSection(
			replays.getHistory(recentCommunityQuery(), HOME_RECENT_MATCHES).map((list) => list.items)
		),
		recentMemberUploads: loadSection(
			replays
				.getMemberHistory(recentMemberQuery(), HOME_RECENT_MEMBER_UPLOADS)
				.map((list) => list.items)
		),
		streams: locals.services.twitch().listStreams().unwrapOr([])
	};
};
