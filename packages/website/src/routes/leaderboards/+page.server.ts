import { parseBoardId } from '$lib/leaderboards';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ locals, url }) => {
	const boardId = parseBoardId(url.searchParams.get('board'));
	return {
		boardId,
		board: unwrapAsync(locals.services.leaderboard.get(boardId))
	};
};
