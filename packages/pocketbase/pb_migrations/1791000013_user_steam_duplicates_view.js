/// <reference path="../pb_data/types.d.ts" />

// Steam ids used by more than one account; the website's user-merge job works
// through this list (older apps can still edit their own `steamIds`). Superusers only.
migrate(
	(app) => {
		const view = new Collection({
			type: 'view',
			name: 'user_steam_duplicates',
			listRule: null,
			viewRule: null,
			viewQuery: `SELECT CAST(s.value AS TEXT) AS id, COUNT(DISTINCT u.id) AS accounts
				FROM users u, json_each(CASE WHEN json_valid(u.steamIds) THEN u.steamIds ELSE '[]' END) s
				WHERE CAST(s.value AS TEXT) != ''
				GROUP BY CAST(s.value AS TEXT)
				HAVING COUNT(DISTINCT u.id) > 1`
		});
		app.save(view);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('user_steam_duplicates'));
	}
);
