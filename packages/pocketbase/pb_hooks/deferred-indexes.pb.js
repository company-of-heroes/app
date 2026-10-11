/// <reference path="../pb_data/types.d.ts" />

'use strict';

// Builds the indexes listed in lib/deferred-indexes.js, one per run, after the server
// listens. A migration would block startup on the large tables. Does nothing once all exist.
$app.onServe().bindFunc((e) => {
	e.next();
	cronAdd('deferred_indexes', '*/2 * * * *', () => {
		require(`${__hooks}/lib/deferred-indexes.js`).runNext();
	});
});
