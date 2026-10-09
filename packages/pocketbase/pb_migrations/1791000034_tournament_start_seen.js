/// <reference path="../pb_data/types.d.ts" />

// When a player saw the "tournament has started" popup, so app and website show it once. Schema only.
migrate(
	(app) => {
		const participants = app.findCollectionByNameOrId('tournament_participants');
		if (!participants.fields.getByName('startSeenAt')) {
			participants.fields.add(
				new Field({
					hidden: false,
					id: 'date_tournament_participants_startSeenAt',
					max: '',
					min: '',
					name: 'startSeenAt',
					presentable: false,
					required: false,
					system: false,
					type: 'date'
				})
			);
			app.save(participants);
		}
	},
	(app) => {
		const participants = app.findCollectionByNameOrId('tournament_participants');
		participants.fields.removeByName('startSeenAt');
		app.save(participants);
	}
);
