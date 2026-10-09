/// <reference path="../pb_data/types.d.ts" />

// An earlier version of 1791000028_tournaments made `tournament_matches.position` required.
// Positions start at 0 and PocketBase treats 0 as blank, so starting a tournament failed.

migrate(
	(app) => {
		const matches = app.findCollectionByNameOrId('tournament_matches');
		const position = matches.fields.getByName('position');
		if (position && position.required) {
			position.required = false;
			app.save(matches);
		}
	},
	() => {
		// Required was a bug; nothing to restore.
	}
);
