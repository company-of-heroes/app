/// <reference path="../pb_data/types.d.ts" />

// Request logs filled auxiliary.db with ~740k rows (2.5 GB) a day, 96% of them successful
// requests at INFO level from the website's own services. Deleting the expired ones made
// every start take ~35 s instead of under a second. Keep warnings and errors only, for a week.
// Settings only; the first start afterwards still clears the old logs once.
migrate(
	(app) => {
		const settings = app.settings();
		settings.logs.minLevel = 4;
		settings.logs.maxDays = 7;
		app.save(settings);
	},
	(app) => {
		const settings = app.settings();
		settings.logs.minLevel = 0;
		settings.logs.maxDays = 5;
		app.save(settings);
	}
);
