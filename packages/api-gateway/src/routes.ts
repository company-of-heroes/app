/**
 * Legacy PocketBase custom routes that are now served by the website.
 * `legacy` is matched against the request path (`:name` = one segment);
 * the rewritten path keeps the captured segments and the original query string.
 * Add an entry only after `scripts/golden` shows the v1 route answers identically.
 */
export type RouteRule = { method: string; legacy: string; v1: string };

export const ROUTES: RouteRule[] = [
	{ method: 'GET', legacy: '/api/match-history', v1: '/api/v1/match-history' },
	{ method: 'GET', legacy: '/api/history-maps', v1: '/api/v1/history-maps' },
	{ method: 'GET', legacy: '/api/history-players', v1: '/api/v1/history-players' },
	{ method: 'GET', legacy: '/api/twitch/streams', v1: '/api/v1/twitch/streams' },
	{ method: 'GET', legacy: '/api/leaderboard/:id', v1: '/api/v1/leaderboards/:id' },
	{ method: 'GET', legacy: '/api/player/search', v1: '/api/v1/players/search' },
	{ method: 'GET', legacy: '/api/player-card/:steamId', v1: '/api/v1/players/:steamId/card' },
	{ method: 'GET', legacy: '/api/player/:id', v1: '/api/v1/players/:id' },
	{ method: 'GET', legacy: '/api/player-performance', v1: '/api/v1/player-performance' },
	{ method: 'GET', legacy: '/api/match/:id', v1: '/api/v1/matches/:id' },
	{ method: 'GET', legacy: '/api/member-replays', v1: '/api/v1/member-replays' },
	{ method: 'GET', legacy: '/api/member-replays/maps', v1: '/api/v1/member-replays/maps' },
	{
		method: 'POST',
		legacy: '/api/member-replays/preview-stats',
		v1: '/api/v1/member-replays/preview-stats'
	},
	{ method: 'GET', legacy: '/api/member-replays/:id', v1: '/api/v1/member-replays/:id' },
	{ method: 'POST', legacy: '/api/member-replays', v1: '/api/v1/member-replays' },
	{ method: 'PATCH', legacy: '/api/member-replays/:id', v1: '/api/v1/member-replays/:id' },
	{ method: 'DELETE', legacy: '/api/member-replays/:id', v1: '/api/v1/member-replays/:id' },
	{
		method: 'POST',
		legacy: '/api/member-replays/:id/delete',
		v1: '/api/v1/member-replays/:id/delete'
	},
	{
		method: 'POST',
		legacy: '/api/member-replays/from-match/:id/publish',
		v1: '/api/v1/member-replays/from-match/:id/publish'
	},
	{ method: 'POST', legacy: '/api/player-ratings/ingest', v1: '/api/v1/player-ratings/ingest' },
	{
		method: 'POST',
		legacy: '/api/player-ratings/harvest/profiles',
		v1: '/api/v1/player-ratings/harvest/profiles'
	},
	{ method: 'GET', legacy: '/api/player-ratings/history', v1: '/api/v1/player-ratings/history' },
	{ method: 'GET', legacy: '/api/player-ratings/:steamId', v1: '/api/v1/player-ratings/:steamId' },
	{ method: 'GET', legacy: '/api/match-filters/:scope', v1: '/api/v1/match-filters/:scope' },
	{ method: 'GET', legacy: '/api/replay-filters', v1: '/api/v1/replay-filters' },
	{
		method: 'GET',
		legacy: '/api/smurf-watch/worker/batch',
		v1: '/api/v1/smurf-watch/worker/batch'
	},
	{
		method: 'GET',
		legacy: '/api/smurf-watch/worker/coplay/:profileId',
		v1: '/api/v1/smurf-watch/worker/coplay/:profileId'
	},
	{ method: 'PATCH', legacy: '/api/smurf-watch/worker/:id', v1: '/api/v1/smurf-watch/worker/:id' },
	{ method: 'POST', legacy: '/api/smurf-watch/enqueue', v1: '/api/v1/smurf-watch/enqueue' },
	{ method: 'GET', legacy: '/api/smurf-watch/:steamId', v1: '/api/v1/smurf-watch/:steamId' },
	{ method: 'GET', legacy: '/api/live-lobbies', v1: '/api/v1/live-lobbies' },
	{ method: 'GET', legacy: '/api/live-lobbies/:id', v1: '/api/v1/live-lobbies/:id' },
	// Login: Steam OpenID (browser redirects), app-to-browser handoff codes, impersonation.
	{ method: 'GET', legacy: '/api/auth/steam/start', v1: '/auth/steam/start' },
	{ method: 'GET', legacy: '/api/auth/steam/callback', v1: '/api/v1/auth/steam/callback' },
	{ method: 'POST', legacy: '/api/auth/handoff', v1: '/api/v1/auth/handoff' },
	{ method: 'POST', legacy: '/api/auth/handoff/exchange', v1: '/api/v1/auth/handoff/exchange' },
	{ method: 'POST', legacy: '/api/impersonate/:userId', v1: '/api/v1/impersonate/:userId' },
	{ method: 'POST', legacy: '/api/overlay/publish', v1: '/api/v1/overlays' },
	{ method: 'POST', legacy: '/api/match/:id/download', v1: '/api/v1/matches/:id/download' },
	{
		method: 'POST',
		legacy: '/api/member-replays/:id/download',
		v1: '/api/v1/member-replays/:id/download'
	},
	{ method: 'POST', legacy: '/api/lobbies/:id/download', v1: '/api/v1/lobbies/:id/download' },
	{ method: 'POST', legacy: '/api/lobbies/:id/attach-replay', v1: '/api/v1/lobbies/:id/replay' },
	// Writes older apps make straight to PocketBase collections (social rows, lobbies, live lobbies).
	...[
		'lobbies',
		'lobbies_live',
		'hidden_matches',
		'hidden_match_keywords',
		'lobby_likes',
		'replay_likes',
		'lobby_comments',
		'replay_comments',
		'lobby_comment_likes',
		'replay_comment_likes',
		'player_likes'
	].flatMap((collection): RouteRule[] => [
		{
			method: 'POST',
			legacy: `/api/collections/${collection}/records`,
			v1: `/api/v1/compat/collections/${collection}/records`
		},
		{
			method: 'PATCH',
			legacy: `/api/collections/${collection}/records/:id`,
			v1: `/api/v1/compat/collections/${collection}/records/:id`
		},
		{
			method: 'DELETE',
			legacy: `/api/collections/${collection}/records/:id`,
			v1: `/api/v1/compat/collections/${collection}/records/:id`
		}
	])
];

/** Whether any rule (any method) handles this path, e.g. to answer a CORS preflight. */
export function rewritesPath(pathname: string, rules: RouteRule[] = ROUTES): boolean {
	return [...new Set(rules.map((rule) => rule.method))].some(
		(method) => rewrite(method, pathname, rules) !== null
	);
}

export function rewrite(
	method: string,
	pathname: string,
	rules: RouteRule[] = ROUTES
): string | null {
	const parts = pathname.split('/');
	for (const rule of rules) {
		if (rule.method !== method) {
			continue;
		}

		const pattern = rule.legacy.split('/');
		if (pattern.length !== parts.length) {
			continue;
		}

		const params: Record<string, string> = {};
		const matches = pattern.every((segment, i) => {
			if (segment.startsWith(':')) {
				params[segment.slice(1)] = parts[i];
				return parts[i] !== '';
			}

			return segment === parts[i];
		});
		if (matches) {
			return rule.v1.replace(/:(\w+)/g, (_, name: string) => params[name]);
		}
	}
	return null;
}
