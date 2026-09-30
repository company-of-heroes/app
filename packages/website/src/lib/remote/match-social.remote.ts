import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { isStaffUser } from '$lib/auth/user';
import { unwrapAsync } from '$lib/errors/unwrap';

/** `lobby` = community match, `replay` = member replay. */
const kind = z.enum(['lobby', 'replay']);
const id = z.string().min(1);
const upOrDown = z.union([z.literal(1), z.literal(-1)]);
const commentText = z.string().min(1).max(2000);

function signedIn() {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, locals.t('Sign in to do that.'));
	}

	return { services: locals.services, user: locals.user };
}

export const listComments = query(z.object({ kind, targetId: id }), ({ kind, targetId }) => {
	const social = getRequestEvent().locals.api.matchSocial;
	return unwrapAsync(
		kind === 'replay' ? social.listReplayComments(targetId) : social.listComments(targetId)
	);
});

export const searchMentionUsers = query(z.string().min(1), (queryText) => {
	return unwrapAsync(getRequestEvent().locals.api.matchSocial.searchMentionUsers(queryText));
});

export const getMyVote = query(z.object({ kind, targetId: id }), ({ kind, targetId }) => {
	const social = getRequestEvent().locals.api.matchSocial;
	return unwrapAsync(
		kind === 'replay' ? social.getMyReplayVote(targetId) : social.getMyVote(targetId)
	);
});

/** Voting the same way twice removes the vote. */
export const vote = command(
	z.object({ kind, targetId: id, value: upOrDown }),
	async ({ kind, targetId, value }) => {
		const { services, user } = signedIn();
		const result = await unwrapAsync(
			services.social.vote({ kind, id: targetId }, user.id, value, { toggle: true })
		);
		return { vote: result.vote, likeCount: result.likeCount };
	}
);

export const createComment = command(
	z.object({ kind, targetId: id, text: commentText, parentId: id.optional() }),
	async ({ kind, targetId, text, parentId }) => {
		const { services, user } = signedIn();
		const created = await unwrapAsync(
			services.social.comment({ kind, id: targetId }, user.id, text, parentId)
		);
		return unwrapAsync(services.social.commentView(kind, created.id, user.id));
	}
);

export const voteComment = command(
	z.object({ kind, commentId: id, value: upOrDown }),
	async ({ kind, commentId, value }) => {
		const { services, user } = signedIn();
		const result = await unwrapAsync(
			services.social.voteComment(kind, commentId, user.id, value, { toggle: true })
		);
		return { vote: result.vote, likeCount: result.likeCount };
	}
);

export const updateComment = command(
	z.object({ kind, commentId: id, text: commentText }),
	async ({ kind, commentId, text }) => {
		const { services, user } = signedIn();
		await unwrapAsync(services.social.editComment(kind, commentId, user.id, text));
		return unwrapAsync(services.social.commentView(kind, commentId, user.id));
	}
);

export const deleteComment = command(
	z.object({ kind, commentId: id, note: z.string().max(500).optional() }),
	async ({ kind, commentId, note }) => {
		const { services, user } = signedIn();
		await unwrapAsync(
			services.social.deleteComment(
				kind,
				commentId,
				{ id: user.id, isStaff: isStaffUser(user) },
				note
			)
		);
		return unwrapAsync(services.social.commentView(kind, commentId, user.id));
	}
);
