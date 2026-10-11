/// <reference path="../pb_data/types.d.ts" />

// Soft-deleted tournaments (`deletedAt`, `deletedBy`): hidden like drafts, only staff (and
// through the website the host) still see them. Schema and rules only.
const STAFF = '@request.auth.role = "admin" || @request.auth.role = "moderator"';
const RULES = {
	tournaments: {
		old: `status != "draft" || ${STAFF}`,
		next: `(status != "draft" && deletedAt = "") || ${STAFF}`
	},
	tournament_participants: {
		old: `tournament.status != "draft" || ${STAFF}`,
		next: `(tournament.status != "draft" && tournament.deletedAt = "") || ${STAFF}`
	},
	tournament_matches: {
		old: `tournament.status != "draft" || ${STAFF}`,
		next: `(tournament.status != "draft" && tournament.deletedAt = "") || ${STAFF}`
	}
};

migrate(
	(app) => {
		const tournaments = app.findCollectionByNameOrId('tournaments');
		if (!tournaments.fields.getByName('deletedAt')) {
			tournaments.fields.add(
				new Field({
					hidden: false,
					id: 'date_tournaments_deletedAt',
					max: '',
					min: '',
					name: 'deletedAt',
					presentable: false,
					required: false,
					system: false,
					type: 'date'
				})
			);
		}

		if (!tournaments.fields.getByName('deletedBy')) {
			tournaments.fields.add(
				new Field({
					cascadeDelete: false,
					collectionId: '_pb_users_auth_',
					hidden: false,
					id: 'relation_tournaments_deletedBy',
					maxSelect: 1,
					minSelect: 0,
					name: 'deletedBy',
					presentable: false,
					required: false,
					system: false,
					type: 'relation'
				})
			);
		}

		app.save(tournaments);
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
		tournaments.fields.removeByName('deletedBy');
		tournaments.fields.removeByName('deletedAt');
		app.save(tournaments);
	}
);
