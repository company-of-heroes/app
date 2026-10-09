/// <reference path="../pb_data/types.d.ts" />

// Tournament extras: problem reports with a staff follow-up, rules acceptance, automatic
// registration close, match time proposals, a stream link and a featured match. Schema only.
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

const relation = (collection, name, collectionId, cascadeDelete = false, required = false) => ({
	cascadeDelete,
	collectionId,
	hidden: false,
	id: `relation_${collection}_${name}`,
	maxSelect: 1,
	minSelect: 0,
	name,
	presentable: false,
	required,
	system: false,
	type: 'relation'
});

const select = (collection, name, values, required = true) => ({
	hidden: false,
	id: `select_${collection}_${name}`,
	maxSelect: 1,
	name,
	presentable: false,
	required,
	system: false,
	type: 'select',
	values
});

const json = (collection, name) => ({
	hidden: false,
	id: `json_${collection}_${name}`,
	maxSize: 0,
	name,
	presentable: false,
	required: false,
	system: false,
	type: 'json'
});

const id = (collection) => ({
	autogeneratePattern: '[a-z0-9]{15}',
	hidden: false,
	id: `text_${collection}_id`,
	max: 15,
	min: 15,
	name: 'id',
	pattern: '^[a-z0-9]+$',
	presentable: false,
	primaryKey: true,
	required: true,
	system: true,
	type: 'text'
});

const autodates = (collection) => [
	{
		hidden: false,
		id: `autodate_${collection}_created`,
		name: 'created',
		onCreate: true,
		onUpdate: false,
		presentable: false,
		system: false,
		type: 'autodate'
	},
	{
		hidden: false,
		id: `autodate_${collection}_updated`,
		name: 'updated',
		onCreate: true,
		onUpdate: true,
		presentable: false,
		system: false,
		type: 'autodate'
	}
];

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

function exists(app, name) {
	try {
		app.findCollectionByNameOrId(name);
		return true;
	} catch {
		return false;
	}
}

// Read and written through the website (superuser), like the other tournament tables.
const closed = {
	createRule: null,
	deleteRule: null,
	updateRule: null,
	listRule: null,
	viewRule: null
};

migrate(
	(app) => {
		const matches = addMissing(app, 'tournament_matches', [
			date('tournament_matches', 'scheduledAt')
		]);
		const tournaments = addMissing(app, 'tournaments', [
			date('tournaments', 'rulesUpdatedAt'),
			date('tournaments', 'autoClosedAt'),
			{
				exceptDomains: null,
				hidden: false,
				id: 'url_tournaments_streamUrl',
				name: 'streamUrl',
				onlyDomains: null,
				presentable: false,
				required: false,
				system: false,
				type: 'url'
			},
			relation('tournaments', 'featuredMatch', matches.id)
		]);
		const participants = addMissing(app, 'tournament_participants', [
			date('tournament_participants', 'rulesAcceptedAt')
		]);

		if (!exists(app, 'tournament_reports')) {
			const c = 'tournament_reports';
			app.save(
				new Collection({
					...closed,
					name: c,
					type: 'base',
					indexes: [
						'CREATE INDEX `idx_tournament_reports_tournament` ON `tournament_reports` (`tournament`, `status`, `created`)',
						'CREATE INDEX `idx_tournament_reports_match` ON `tournament_reports` (`match`, `reporter`)'
					],
					fields: [
						id(c),
						relation(c, 'tournament', tournaments.id, true, true),
						relation(c, 'match', matches.id, true, true),
						relation(c, 'reporter', '_pb_users_auth_', true, true),
						relation(c, 'participant', participants.id, true),
						select(c, 'reason', ['no_show', 'disconnect', 'wrong_result', 'conduct', 'other']),
						text(c, 'message', 2000),
						select(c, 'status', ['open', 'resolved', 'dismissed']),
						text(c, 'staffNote', 2000),
						relation(c, 'handledBy', '_pb_users_auth_'),
						date(c, 'handledAt'),
						...autodates(c)
					]
				})
			);
		}

		if (!exists(app, 'tournament_schedules')) {
			const c = 'tournament_schedules';
			app.save(
				new Collection({
					...closed,
					name: c,
					type: 'base',
					indexes: [
						'CREATE INDEX `idx_tournament_schedules_match` ON `tournament_schedules` (`match`, `status`)',
						'CREATE INDEX `idx_tournament_schedules_accepted` ON `tournament_schedules` (`status`, `acceptedTime`)'
					],
					fields: [
						id(c),
						relation(c, 'tournament', tournaments.id, true, true),
						relation(c, 'match', matches.id, true, true),
						relation(c, 'proposedBy', participants.id, true, true),
						json(c, 'times'),
						select(c, 'status', ['pending', 'accepted', 'declined', 'superseded']),
						date(c, 'acceptedTime'),
						relation(c, 'respondedBy', participants.id),
						date(c, 'reminderSentAt'),
						...autodates(c)
					]
				})
			);
		}
	},
	(app) => {
		for (const name of ['tournament_reports', 'tournament_schedules']) {
			try {
				app.delete(app.findCollectionByNameOrId(name));
			} catch {
				// already gone
			}
		}

		for (const [name, fields] of [
			['tournaments', ['rulesUpdatedAt', 'autoClosedAt', 'streamUrl', 'featuredMatch']],
			['tournament_matches', ['scheduledAt']],
			['tournament_participants', ['rulesAcceptedAt']]
		]) {
			const collection = app.findCollectionByNameOrId(name);
			for (const field of fields) {
				collection.fields.removeByName(field);
			}

			app.save(collection);
		}
	}
);
