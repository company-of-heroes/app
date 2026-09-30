import { z } from 'zod';
import { handle, parseBody, requireUser } from '$lib/server/http';
import { targetKind } from '$lib/server/social-params';

const body = z.object({ text: z.string().max(5000), parent: z.string().max(15).optional() });

export const POST = handle((event) => {
	const { social } = event.locals.services;
	return requireUser(event)
		.andThen((user) => targetKind(event.params.kind).map((kind) => ({ user, kind })))
		.asyncAndThen(({ user, kind }) => {
			const target = { kind, id: event.params.id ?? '' };
			return parseBody(body, event.request)
				.andThen(({ text, parent }) => social.comment(target, user.id, text, parent || undefined))
				.andThen((created) => social.commentView(kind, created.id, user.id));
		});
});
