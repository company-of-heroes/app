import type { RequestEvent } from '@sveltejs/kit';
import { isStaffUser } from '$lib/auth/user';
import { publicRecord } from '$lib/server/domain/public-record';
import { handle, readRecordBody, requireUser } from '$lib/server/http';

/**
 * PocketBase-compatible writes for older app versions (routed here by the
 * api-gateway): /api/collections/{collection}/records[/{id}]. The compat service
 * knows which collections are handled and by which service.
 */
function context(event: RequestEvent) {
	return requireUser(event).andThen((user) =>
		event.locals.services.compat.handler(event.params.collection ?? '').map((handler) => ({
			handler,
			id: event.params.id ?? '',
			actor: { id: user.id, isStaff: isStaffUser(user) },
			options: {
				expand: event.url.searchParams.get('expand') ?? undefined,
				fields: event.url.searchParams.get('fields') ?? undefined
			}
		}))
	);
}

export const POST = handle((event) =>
	context(event).asyncAndThen(({ handler, actor, options }) =>
		readRecordBody(event.request)
			.andThen(({ data, files }) => handler.create(data, files, actor, options))
			.map(publicRecord)
	)
);

export const PATCH = handle((event) =>
	context(event).asyncAndThen(({ handler, id, actor, options }) =>
		readRecordBody(event.request)
			.andThen(({ data, files }) => handler.update(id, data, files, actor, options))
			.map(publicRecord)
	)
);

export const DELETE = handle((event) =>
	context(event)
		.asyncAndThen(({ handler, id, actor }) => handler.remove(id, actor))
		.map(() => new Response(null, { status: 204 }))
);
