/// <reference path="../pb_data/types.d.ts" />

// Hidden tournaments (`hidden`): kept out of the public lists, hall of fame and trophies; staff,
// the host and the players still open it and it keeps running. Schema and rules only.
const STAFF = '@request.auth.role = "admin" || @request.auth.role = "moderator"';
const RULES = {
	tournaments: {
		old: `(status != "draft" && deletedAt = "") || ${STAFF}`,
		next: `(status != "draft" && deletedAt = "" && hidden = false) || ${STAFF}`
	},
	tournament_participants: {
		old: `(tournament.status != "draft" && tournament.deletedAt = "") || ${STAFF}`,
		next: `(tournament.status != "draft" && tournament.deletedAt = "" && tournament.hidden = false) || ${STAFF}`
	},
	tournament_matches: {
		old: `(tournament.status != "draft" && tournament.deletedAt = "") || ${STAFF}`,
		next: `(tournament.status != "draft" && tournament.deletedAt = "" && tournament.hidden = false) || ${STAFF}`
	}
};

migrate(
	(app) => {
		const tournaments = app.findCollectionByNameOrId('tournaments');
		if (!tournaments.fields.getByName('hidden')) {
			tournaments.fields.add(
				new Field({
					hidden: false,
					id: 'bool_tournaments_hidden',
					name: 'hidden',
					presentable: false,
					required: false,
					system: false,
					type: 'bool'
				})
			);
			app.save(tournaments);
		}

		for (const [name, rule] of Object.entries(RULES)) {
			const collection = app.findCollectionByNameOrId(name);
			collection.listRule = rule.next;
			collection.viewRule = rule.next;
			app.save(collection);
		}
	},
	(app) => {
		for (const [name, rule] of Object.entries(RULES)) {
			const collection = app.findCollectionByNameOrId(name);
			collection.listRule = rule.old;
			collection.viewRule = rule.old;
			app.save(collection);
		}

		const tournaments = app.findCollectionByNameOrId('tournaments');
		tournaments.fields.removeByName('hidden');
		app.save(tournaments);
	}
);
