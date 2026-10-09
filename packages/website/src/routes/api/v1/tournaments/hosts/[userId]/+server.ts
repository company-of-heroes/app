import { handle, requireStaff } from '$lib/server/http';

/** Staff take the host role away; the host's tournaments stay. */
export const DELETE = handle((event) =>
	requireStaff(event).asyncAndThen(() =>
		event.locals.services.tournamentHosts.revoke(event.params.userId!).map(() => ({ ok: true }))
	)
);
