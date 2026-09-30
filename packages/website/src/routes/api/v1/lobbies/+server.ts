import { handle, parseBody, requireUser } from '$lib/server/http';
import { lobbyCreateSchema } from '$lib/server/domain/lobby-writes';

/** Starts (or finds) the match for a Relic session; returns the lobby record. */
export const POST = handle((event) => {
	const { lobbies } = event.locals.services;
	return requireUser(event).asyncAndThen((user) =>
		parseBody(lobbyCreateSchema, event.request)
			.andThen((input) => lobbies.ensure(user.id, input))
			.andThen(({ id }) => lobbies.view(id))
	);
});
