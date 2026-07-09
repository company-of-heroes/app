/// <reference path="../pb_data/types.d.ts" />

migrate(() => {
	// Snapshot is populated lazily on the first /api/match-filters/community request.
}, () => {
	// no-op
});
