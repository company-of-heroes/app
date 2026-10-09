/// <reference path="../pb_data/types.d.ts" />

// The medal a tournament's champion gets on their profile: a file name from
// `shared-assets/medals` (e.g. `medal-042`), picked by staff. Empty uses the drawn default.

migrate(
	(app) => {
		const tournaments = app.findCollectionByNameOrId('tournaments');
		if (tournaments.fields.getByName('medal')) {
			return;
		}

		tournaments.fields.add(
			new Field({
				autogeneratePattern: '',
				hidden: false,
				id: 'text_tournaments_medal',
				max: 20,
				min: 0,
				name: 'medal',
				pattern: '^(medal-[0-9]{3})?$',
				presentable: false,
				primaryKey: false,
				required: false,
				system: false,
				type: 'text'
			})
		);
		app.save(tournaments);
	},
	(app) => {
		const tournaments = app.findCollectionByNameOrId('tournaments');
		tournaments.fields.removeByName('medal');
		app.save(tournaments);
	}
);
