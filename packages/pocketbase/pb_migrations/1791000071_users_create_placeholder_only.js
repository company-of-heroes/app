/// <reference path="../pb_data/types.d.ts" />

// Accounts with a real email are created by the website only (superuser, after a Turnstile
// check), so bots cannot use the public API to mail verification links to strangers. The
// desktop app still creates anonymous accounts on a generated `@fknoobs.com` placeholder,
// which never gets mail (pb_hooks/mail-filter). Rules only.
const OLD = '@request.body.role:isset = false && @request.body.steamIds:isset = false';
const NEXT = `${OLD} && @request.body.email:lower ~ "%@fknoobs.com"`;

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.createRule = NEXT;
		app.save(users);
	},
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.createRule = OLD;
		app.save(users);
	}
);
