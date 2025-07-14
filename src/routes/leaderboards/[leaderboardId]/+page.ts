import { relic } from '$lib/relic';

export const load = async ({ params }) => {
	const stats = await relic.getLeaderboard(parseInt(params.leaderboardId));

	return {
		stats
	};
};
