/// <reference path="../pb_data/types.d.ts" />

// When a tournament finished (the hall of fame's date; `updated` moves with later edits).
// Schema only.
migrate(
	(app) => {
		const tournaments = app.findCollectionByNameOrId('tournaments');
		if (!tournaments.fields.getByName('completedAt')) {
			tournaments.fields.add(
				new Field({
					hidden: false,
					id: 'date_tournaments_completedAt',
					max: '',
					min: '',
					name: 'completedAt',
					presentable: false,
					required: false,
					system: false,
					type: 'date'
				})
			);
			app.save(tournaments);
		}
	},
	(app) => {
		const tournaments = app.findCollectionByNameOrId('tournaments');
		tournaments.fields.removeByName('completedAt');
		app.save(tournaments);
	}
);
