/// <reference path="../pb_data/types.d.ts" />

// Allow any signed-in user through the API rule; onRecordUpdateRequest in
// lobby-attach-replay enforces owner vs participant (replay-only) access.
migrate(
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		lobbies.updateRule = '@request.auth.id != ""';
		app.save(lobbies);
	},
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		lobbies.updateRule = '@request.auth.id = user';
		app.save(lobbies);
	}
);
