import { handle, readRecordBody, requireService } from '$lib/server/http';

/** Smurf worker: stores what it found out about one account. */
export const PATCH = handle((event) =>
	requireService(event)
		.asyncAndThen(() => readRecordBody(event.request))
		.andThen(({ data }) => event.locals.services.smurf.workerUpdate(event.params.id ?? '', data))
);
