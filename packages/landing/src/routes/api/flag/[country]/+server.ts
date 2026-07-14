import type { RequestHandler } from './$types';

const FLAG_API = 'https://flagsapi.com';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const country = params.country?.toUpperCase();

	if (!country || !/^[A-Z]{2}$/.test(country)) {
		return new Response('Invalid country code', { status: 400 });
	}

	const response = await fetch(`${FLAG_API}/${country}/shiny/64.png`);

	if (!response.ok) {
		return new Response('Flag not found', { status: response.status });
	}

	return new Response(response.body, {
		headers: {
			'Content-Type': response.headers.get('Content-Type') ?? 'image/png',
			'Cache-Control': 'public, max-age=86400',
			'Access-Control-Allow-Origin': '*'
		}
	});
};
