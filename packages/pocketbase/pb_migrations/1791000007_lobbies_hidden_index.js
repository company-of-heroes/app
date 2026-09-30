/// <reference path="../pb_data/types.d.ts" />

// The website reads the (few) hidden lobbies with `isHidden = true`. Without an
// index SQLite reads every lobby row, including its ~30KB players JSON.
migrate(
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		lobbies.indexes.push('CREATE INDEX `idx_lobbies_is_hidden` ON `lobbies` (`isHidden`)');
		app.save(lobbies);
		app.db().newQuery('ANALYZE lobbies').execute();
	},
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		lobbies.indexes = lobbies.indexes.filter((index) => !index.includes('`idx_lobbies_is_hidden`'));
		app.save(lobbies);
	}
);
