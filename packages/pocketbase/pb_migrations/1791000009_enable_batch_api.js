/// <reference path="../pb_data/types.d.ts" />

// The website's lobby pipeline rewrites a lobby's index rows in one batch request
// (one transaction), so a failed write never leaves half an index behind.
migrate(
	(app) => {
		const settings = app.settings();
		settings.batch.enabled = true;
		settings.batch.maxRequests = 50;
		app.save(settings);
	},
	(app) => {
		const settings = app.settings();
		settings.batch.enabled = false;
		app.save(settings);
	}
);
