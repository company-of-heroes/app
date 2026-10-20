/// <reference path="../pb_data/types.d.ts" />

// Hidden results (`hideResults`): the host keeps scores, winners and the champion away from the
// public to avoid spoilers, until they turn it off. The website (superuser) leaves them out of its
// responses; these rules keep the raw records away from everyone else. Schema and rules only.
const STAFF = '@request.auth.role = "admin" || @request.auth.role = "moderator"';
const RULES = {
	tournaments: {
		old: `(status != "draft" && deletedAt = "" && hidden = false) || ${STAFF}`,
		next: `(status != "draft" && deletedAt = "" && hidden = false && hideResults = false) || ${STAFF}`
	},
	tournament_participants: {
		old: `(tournament.status != "draft" && tournament.deletedAt = "" && tournament.hidden = false) || ${STAFF}`,
		next: `(tournament.status != "draft" && tournament.deletedAt = "" && tournament.hidden = false && tournament.hideResults = false) || ${STAFF}`
	},
	tournament_matches: {
		old: `(tournament.status != "draft" && tournament.deletedAt = "" && tournament.hidden = false) || ${STAFF}`,
		next: `(tournament.status != "draft" && tournament.deletedAt = "" && tournament.hidden = false && tournament.hideResults = false) || ${STAFF}`
	}
};

migrate(
	(app) => {
		const tournaments = app.findCollectionByNameOrId('tournaments');
		if (!tournaments.fields.getByName('hideResults')) {
			tournaments.fields.add(
				new Field({
					hidden: false,
					id: 'bool_tournaments_hide_results',
					name: 'hideResults',
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
		tournaments.fields.removeByName('hideResults');
		app.save(tournaments);
	}
);
