import { handle, parse, readRecordBody, requireUser } from '$lib/server/http';
import { lobbyUpdateSchema } from '$lib/server/domain/lobby-writes';

/**
 * Updates a match. JSON, or multipart with a `replay` file (+ `replayDurationSeconds`);
 * participants other than the owner may only send a replay.
 */
export const PATCH = handle((event) => {
	const id = event.params.id ?? '';
	const { lobbies } = event.locals.services;
	return requireUser(event).asyncAndThen((user) =>
		readRecordBody(event.request)
			.andThen(({ data, files }) =>
				parse(lobbyUpdateSchema, data).asyncAndThen((input) =>
					lobbies.update(
						id,
						user.id,
						input,
						files.replay
							? { file: files.replay, seconds: Number(data.replayDurationSeconds) || 0 }
							: undefined
					)
				)
			)
			.andThen(() => lobbies.view(id))
	);
});

export const DELETE = handle((event) =>
	requireUser(event)
		.asyncAndThen((user) => event.locals.services.lobbies.remove(event.params.id ?? '', user.id))
		.map(() => new Response(null, { status: 204 }))
);
