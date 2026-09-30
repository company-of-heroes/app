/**
 * Replay files (/api/files/lobbies|replays/…) are served by PocketBase; the gateway
 * only limits how fast one IP may fetch them (Cloudflare rate-limit bindings,
 * 8 per 10 s and 40 per minute; signed-in apps get the looser pair).
 */
export type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> };
export type FilesEnv = {
	FILE_BURST: RateLimiter;
	FILE_MINUTE: RateLimiter;
	FILE_AUTH_BURST: RateLimiter;
	FILE_AUTH_MINUTE: RateLimiter;
	/** The website's replay proxy limits per visitor itself and sends this secret. */
	REPLAY_PROXY_SECRET?: string;
};

const FILE_PATHS = /^\/api\/files\/(lobbies|replays)\//;

/** A 429 when the IP is over its limit; null to let the request through. */
export async function limitFileDownload(request: Request, env: FilesEnv): Promise<Response | null> {
	const url = new URL(request.url);
	if ((request.method !== 'GET' && request.method !== 'HEAD') || !FILE_PATHS.test(url.pathname)) {
		return null;
	}

	if (
		env.REPLAY_PROXY_SECRET &&
		request.headers.get('x-replay-proxy') === env.REPLAY_PROXY_SECRET
	) {
		return null;
	}

	const signedIn = Boolean(request.headers.get('authorization') || url.searchParams.get('token'));
	const windows: [RateLimiter, number][] = signedIn
		? [
				[env.FILE_AUTH_BURST, 10],
				[env.FILE_AUTH_MINUTE, 60]
			]
		: [
				[env.FILE_BURST, 10],
				[env.FILE_MINUTE, 60]
			];
	const key = request.headers.get('cf-connecting-ip') ?? 'unknown';
	for (const [limiter, seconds] of windows) {
		if (limiter && !(await limiter.limit({ key })).success) {
			return Response.json(
				{ message: 'Too many download requests', retryAfter: seconds },
				{ status: 429, headers: { 'retry-after': String(seconds), 'cache-control': 'no-store' } }
			);
		}
	}
	return null;
}
