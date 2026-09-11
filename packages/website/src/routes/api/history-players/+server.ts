import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const scope = url.searchParams.get('scope') === 'user' ? 'user' : 'community';
	const params = new URLSearchParams({
		scope,
		q: url.searchParams.get('q') || '',
		limit: url.searchParams.get('limit') || '20'
	});

	if (scope === 'user') {
		if (!locals.user) {
			error(401, 'Unauthorized');
		}

		params.set('userId', locals.user.id);
	}

	try {
		const data = await locals.pocketbase.send(`/api/history-players?${params.toString()}`, {
			method: 'GET'
		});
		return json(data, {
			headers: {
				'Cache-Control': scope === 'community' ? 'public, max-age=30' : 'private, max-age=30'
			}
		});
	} catch (err) {
		const status =
			typeof err === 'object' && err && 'status' in err ? Number((err as { status: number }).status) : 500;
		error(status || 500, 'Failed to search players.');
	}
};
