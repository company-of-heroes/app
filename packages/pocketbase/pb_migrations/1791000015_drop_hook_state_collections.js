/// <reference path="../pb_data/types.d.ts" />

// Collections only the removed PocketBase hooks used: job cursors (`job_state`)
// and precomputed filter lists (`match_filter_snapshots`, now the history_maps /
// history_players views). The down migration recreates them empty.
migrate(
	(app) => {
		for (const name of ['job_state', 'match_filter_snapshots']) {
			try {
				app.delete(app.findCollectionByNameOrId(name));
			} catch {
				// already gone
			}
		}
	},
	(app) => {
		app.save(
			new Collection({
				type: 'base',
				name: 'job_state',
				fields: [
					{ name: 'page', type: 'number' },
					{ name: 'complete', type: 'bool' },
					{ name: 'updatedAt', type: 'autodate', onCreate: true, onUpdate: true }
				]
			})
		);
		app.save(
			new Collection({
				type: 'base',
				name: 'match_filter_snapshots',
				listRule: '',
				viewRule: '',
				fields: [
					{ name: 'maps', type: 'json' },
					{ name: 'players', type: 'json' },
					{ name: 'matchCount', type: 'number' }
				]
			})
		);
	}
);
