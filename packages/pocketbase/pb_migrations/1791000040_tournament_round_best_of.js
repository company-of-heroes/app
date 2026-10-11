/// <reference path="../pb_data/types.d.ts" />

// Match length of the semifinals and quarterfinals (single elimination); 0 = same as the rest.
// Schema only.
const FIELDS = ['semisBestOf', 'quartersBestOf'];

migrate(
	(app) => {
		const tournaments = app.findCollectionByNameOrId('tournaments');
		for (const name of FIELDS) {
			if (!tournaments.fields.getByName(name)) {
				tournaments.fields.add(
					new Field({
						hidden: false,
						id: `number_tournaments_${name}`,
						max: null,
						min: null,
						name,
						onlyInt: true,
						presentable: false,
						required: false,
						system: false,
						type: 'number'
					})
				);
			}
		}

		app.save(tournaments);
	},
	(app) => {
		const tournaments = app.findCollectionByNameOrId('tournaments');
		for (const name of FIELDS) {
			tournaments.fields.removeByName(name);
		}

		app.save(tournaments);
	}
);
