/// <reference path="../pb_data/types.d.ts" />

// When the website last asked Steam for a lender while the account was in a live lobby
// (throttles IsPlayingSharedGame on the app's heartbeat).
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('smurf_watch');
		if (!collection.fields.getByName('last_live_check_at')) {
			collection.fields.add(
				new Field({
					hidden: false,
					id: 'date_smurf_last_live_check',
					max: '',
					min: '',
					name: 'last_live_check_at',
					presentable: false,
					required: false,
					system: false,
					type: 'date'
				})
			);
			app.save(collection);
		}
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('smurf_watch');
		if (collection.fields.getByName('last_live_check_at')) {
			collection.fields.removeByName('last_live_check_at');
			app.save(collection);
		}
	}
);
