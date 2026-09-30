/// <reference path="../pb_data/types.d.ts" />

// Users change their email only through the confirmation flow (requestEmailChange);
// this rule replaces the users-email hook. Role, reputation and verified were
// already protected by the rule, which also replaces the role hooks in main.pb.js.
const PREVIOUS =
	'id = @request.auth.id && @request.body.role:changed = false && @request.body.reputation:changed = false && @request.body.verified:changed = false';

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.updateRule = `${PREVIOUS} && @request.body.email:changed = false`;
		app.save(users);
	},
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.updateRule = PREVIOUS;
		app.save(users);
	}
);
