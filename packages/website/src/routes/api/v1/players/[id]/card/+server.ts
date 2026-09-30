import { json } from '@sveltejs/kit';
import { cardStats } from '$lib/server/domain/player-card';
import { handle } from '$lib/server/http';

/** Compact player summary (older embeds of the player card). */
export const GET = handle((event) =>
	event.locals.services.playerPage.get(event.params.id ?? '').map((page) =>
		json(
			{
				steamId: page.steamId,
				profileId: page.profileId,
				alias: page.alias,
				country: page.country,
				level: page.level,
				avatarUrl: page.avatarUrl,
				stats: cardStats(page.leaderboardStats)
			},
			{ headers: { 'cache-control': 'public, max-age=30, stale-while-revalidate=60' } }
		)
	)
);
