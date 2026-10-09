/// <reference path="../pb_data/types.d.ts" />

// Tournament updates: posts on the tournament's Updates tab (written by staff, or automatically
// for rule changes, disqualifications, deadlines, start and finish), notifications linked to a
// tournament, and when each personal tournament notice went out. Schema only.
const date = (collection, name) => ({
	hidden: false,
	id: `date_${collection}_${name}`,
	max: '',
	min: '',
	name,
	presentable: false,
	required: false,
	system: false,
	type: 'date'
});

const text = (collection, name, max, required = false) => ({
	autogeneratePattern: '',
	hidden: false,
	id: `text_${collection}_${name}`,
	max,
	min: 0,
	name,
	pattern: '',
	presentable: false,
	primaryKey: false,
	required,
	system: false,
	type: 'text'
});

const bool = (collection, name) => ({
	hidden: false,
	id: `bool_${collection}_${name}`,
	name,
	presentable: false,
	required: false,
	system: false,
	type: 'bool'
});

const relation = (collection, name, collectionId, cascadeDelete = false) => ({
	cascadeDelete,
	collectionId,
	hidden: false,
	id: `relation_${collection}_${name}`,
	maxSelect: 1,
	minSelect: 0,
	name,
	presentable: false,
	required: false,
	system: false,
	type: 'relation'
});

function addMissing(app, name, fields) {
	const collection = app.findCollectionByNameOrId(name);
	let changed = false;
	for (const field of fields) {
		if (!collection.fields.getByName(field.name)) {
			collection.fields.add(new Field(field));
			changed = true;
		}
	}

	if (changed) {
		app.save(collection);
	}

	return collection;
}

migrate(
	(app) => {
		const tournaments = addMissing(app, 'tournaments', [date('tournaments', 'reminderSentAt')]);
		addMissing(app, 'tournament_matches', [date('tournament_matches', 'readyNotifiedAt')]);
		addMissing(app, 'tournament_participants', [
			date('tournament_participants', 'outNotifiedAt'),
			date('tournament_participants', 'postsSeenAt')
		]);
		addMissing(app, 'notifications', [
			relation('notifications', 'tournament', tournaments.id, true)
		]);

		try {
			app.findCollectionByNameOrId('tournament_posts');
			return;
		} catch {
			// create below
		}

		const c = 'tournament_posts';
		app.save(
			new Collection({
				// Read and written through the website (superuser), like the other tournament tables.
				createRule: null,
				deleteRule: null,
				updateRule: null,
				listRule: null,
				viewRule: null,
				name: c,
				type: 'base',
				indexes: [
					'CREATE INDEX `idx_tournament_posts_tournament` ON `tournament_posts` (`tournament`, `created`)'
				],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: `text_${c}_id`,
						max: 15,
						min: 15,
						name: 'id',
						pattern: '^[a-z0-9]+$',
						presentable: false,
						primaryKey: true,
						required: true,
						system: true,
						type: 'text'
					},
					relation(c, 'tournament', tournaments.id, true),
					{
						hidden: false,
						id: `select_${c}_kind`,
						maxSelect: 1,
						name: 'kind',
						presentable: false,
						required: true,
						system: false,
						type: 'select',
						values: [
							'announcement',
							'rules',
							'schedule',
							'deadlines',
							'disqualified',
							'seeded',
							'started',
							'finished',
							'cancelled'
						]
					},
					text(c, 'title', 200),
					text(c, 'body', 20000),
					{
						hidden: false,
						id: `json_${c}_data`,
						maxSize: 0,
						name: 'data',
						presentable: false,
						required: false,
						system: false,
						type: 'json'
					},
					bool(c, 'important'),
					bool(c, 'pinned'),
					relation(c, 'createdBy', '_pb_users_auth_'),
					{
						hidden: false,
						id: `autodate_${c}_created`,
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: `autodate_${c}_updated`,
						name: 'updated',
						onCreate: true,
						onUpdate: true,
						presentable: false,
						system: false,
						type: 'autodate'
					}
				]
			})
		);
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('tournament_posts'));
		} catch {
			// already gone
		}

		for (const [name, fields] of [
			['tournaments', ['reminderSentAt']],
			['tournament_matches', ['readyNotifiedAt']],
			['tournament_participants', ['outNotifiedAt', 'postsSeenAt']],
			['notifications', ['tournament']]
		]) {
			const collection = app.findCollectionByNameOrId(name);
			for (const field of fields) {
				collection.fields.removeByName(field);
			}

			app.save(collection);
		}
	}
);
