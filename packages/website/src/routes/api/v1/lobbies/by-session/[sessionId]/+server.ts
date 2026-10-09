import { errAsync } from 'neverthrow';
import { notFound } from '$lib/server/errors';
import { handle, requireUser } from '$lib/server/http';

/**
 * The match of a Relic session, for its own players. The app reads matches from PocketBase
 * directly, which hides hidden matches (tournament games); this is its fallback.
 */
export const GET = handle((event) => {
	const sessionId = Number(event.params.sessionId);
	const { lobbies } = event.locals.services;
	return requireUser(event).asyncAndThen((user) =>
		Number.isInteger(sessionId) && sessionId > 0
			? lobbies
					.bySession(sessionId)
					.andThen((lobby) =>
						lobby
							? lobbies
									.isParticipant(lobby, user.id)
									.andThen((participant) =>
										participant ? lobbies.view(lobby.id) : errAsync(notFound('Match not found.'))
									)
							: errAsync(notFound('Match not found.'))
					)
			: errAsync(notFound('Match not found.'))
	);
});
