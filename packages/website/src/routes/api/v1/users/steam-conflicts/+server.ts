import { handle, requireStaff } from '$lib/server/http';

/** Steam ids claimed by more than one account, for staff to merge or dismiss. */
export const GET = handle((event) =>
	requireStaff(event)
		.asyncAndThen(() => event.locals.services.users.listConflicts())
		.map((conflicts) => ({ conflicts }))
);
