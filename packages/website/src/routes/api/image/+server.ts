import type { RequestHandler } from './$types';

const ALLOWED_HOSTS = new Set([
	'flagsapi.com',
	'www.flagsapi.com',
	'avatars.steamstatic.com',
	'avatars.akamai.steamstatic.com',
	'avatars.cloudflare.steamstatic.com',
	'steamcdn-a.akamaihd.net'
]);

const CACHE_HEADERS = {
	'Cache-Control': 'public, max-age=86400',
	'Access-Control-Allow-Origin': '*'
};

export const GET: RequestHandler = async ({ url, fetch }) => {
	const target = url.searchParams.get('url');
	if (!target) {
		return new Response('Missing url', { status: 400 });
	}

	let parsed: URL;
	try {
		parsed = new URL(target);
	} catch {
		return new Response('Invalid url', { status: 400 });
	}

	if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
		return new Response('Forbidden host', { status: 403 });
	}

	const response = await fetch(parsed.href);
	if (!response.ok) {
		return new Response('Upstream error', { status: response.status });
	}

	return new Response(response.body, {
		headers: {
			...CACHE_HEADERS,
			'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream'
		}
	});
};
