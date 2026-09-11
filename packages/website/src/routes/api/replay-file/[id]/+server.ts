import type { RequestHandler } from './$types';

function errorResponse(status: number, message: string, retryAfter?: number): Response {
	const headers: Record<string, string> = {
		'Cache-Control': 'no-store'
	};
	if (retryAfter !== undefined) {
		headers['Retry-After'] = String(retryAfter);
	}

	return new Response(message, { status, headers });
}

export const GET: RequestHandler = async ({ locals, params, getClientAddress }) => {
	const result = await locals.services.replays().getFile(params.id, getClientAddress());
	if (result.isErr()) {
		return errorResponse(result.error.status, result.error.message, result.error.retryAfter);
	}

	const file = result.value;
	return new Response(file.body, {
		headers: {
			'Content-Type': file.contentType,
			'Content-Disposition': `attachment; filename="${file.filename.replace(/"/g, '')}"`,
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
