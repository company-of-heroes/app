import type { RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { handle, parseBody, requireUser } from '$lib/server/http';
import { targetKind } from '$lib/server/social-params';

/** The signed-in user and the comment kind from the route. */
const context = (event: RequestEvent) =>
	requireUser(event).andThen((user) =>
		targetKind(event.params.kind).map((kind) => ({ user, kind }))
	);

export const PATCH = handle((event) => {
	const commentId = event.params.commentId ?? '';
	const { social } = event.locals.services;
	return context(event).asyncAndThen(({ user, kind }) =>
		parseBody(z.object({ text: z.string().max(5000) }), event.request)
			.andThen(({ text }) => social.editComment(kind, commentId, user.id, text))
			.andThen(() => social.commentView(kind, commentId, user.id))
	);
});

/** Soft delete; staff must give a reason (`?note=`). */
export const DELETE = handle((event) => {
	const commentId = event.params.commentId ?? '';
	const { social } = event.locals.services;
	return context(event).asyncAndThen(({ user, kind }) =>
		social
			.deleteComment(
				kind,
				commentId,
				{ id: user.id, isStaff: isStaffUser(user) },
				event.url.searchParams.get('note') ?? undefined
			)
			.andThen(() => social.commentView(kind, commentId, user.id))
	);
});
