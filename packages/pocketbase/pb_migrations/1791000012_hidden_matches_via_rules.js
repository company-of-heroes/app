/// <reference path="../pb_data/types.d.ts" />

// Hidden matches: `lobbies.isHidden` (kept by the website's hidden-matches service)
// replaces the list/view hooks that filtered hidden lobbies for non-staff, and
// hiding/unhiding goes through the website (older apps via the api-gateway).
const STAFF = '@request.auth.role = "admin" || @request.auth.role = "moderator"';
const VISIBLE = `isHidden = false || ${STAFF}`;

migrate(
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		lobbies.listRule = VISIBLE;
		lobbies.viewRule = VISIBLE;
		app.save(lobbies);

		for (const name of ['hidden_matches', 'hidden_match_keywords']) {
			const collection = app.findCollectionByNameOrId(name);
			collection.createRule = null;
			collection.updateRule = null;
			collection.deleteRule = null;
			app.save(collection);
		}
	},
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		lobbies.listRule = '';
		lobbies.viewRule = '';
		app.save(lobbies);

		for (const name of ['hidden_matches', 'hidden_match_keywords']) {
			const collection = app.findCollectionByNameOrId(name);
			collection.createRule = STAFF;
			collection.updateRule = STAFF;
			collection.deleteRule = STAFF;
			app.save(collection);
		}
	}
);
