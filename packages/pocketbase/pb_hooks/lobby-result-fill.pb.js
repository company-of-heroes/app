/// <reference path="../pb_data/types.d.ts" />

'use strict';

// Fills lobbies.result from Relic match history for rows with needsResult=true.
// Note: cron callbacks run in an isolated scope — require inside the callback.
$app.onServe().bindFunc((e) => {
	e.next();

	cronAdd('lobby_result_fill', '* * * * *', () => {
		const fill = require(`${__hooks}/lib/lobby-result-fill.js`);
		const result = fill.runBatch();

		if (result.pending === 0 && !result.liveReset && !result.recovered) {
			return;
		}

		console.log(
			`[lobby_result_fill] pending=${result.pending} filled=${result.filled} ` +
				`bumped=${result.bumped} failed=${result.failed} fetched=${result.fetched}` +
				` liveReset=${result.liveReset || 0} recovered=${result.recovered || 0}`
		);
	});
});
