import { isStaffUser } from '$lib/auth/user';
import { handle, parseBody, requireUser } from '$lib/server/http';
import { memberUpdateSchema } from '$lib/server/domain/member-replay-writes';

export const GET = handle(({ params, locals, setHeaders }) => {
	const viewer = locals.user ? { id: locals.user.id, isStaff: isStaffUser(locals.user) } : null;
	return locals.services.memberReplays.get(params.id ?? '', viewer).map((replay) => {
		setHeaders({
			'cache-control':
				replay.visibility === 'deleted'
					? 'private, no-store'
					: 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
		});
		return replay;
	});
});

/** Owner edits the replay (`visibility: 'deleted'` deletes it). */
export const PATCH = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		parseBody(memberUpdateSchema, event.request).andThen((input) =>
			event.locals.services.memberReplays.update(event.params.id ?? '', user.id, input)
		)
	)
);

export const DELETE = handle((event) =>
	requireUser(event).asyncAndThen((user) =>
		event.locals.services.memberReplays.remove(event.params.id ?? '', user.id)
	)
);
