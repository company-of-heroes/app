/// <reference path="../pb_data/types.d.ts" />

'use strict';

// Every 3 minutes on average, on odd minutes only (1, 5, 7, 11, …), so it never shares a
// minute with the deferred-index cron (even minutes). Once every row is filled a run is
// one indexed lookup that finds nothing.
$app.onServe().bindFunc((e) => {
	e.next();
	cronAdd('alias_lower_backfill', '1-59/6,5-59/6 * * * *', () => {
		require(`${__hooks}/lib/alias-lower-backfill.js`).runBatch();
	});
});
