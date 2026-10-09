/// <reference path="../pb_data/types.d.ts" />

// Tournament games: deadlines per round (with a per-match override), "start tournament game"
// claims that tie a lobby to a match, hiding those lobbies until the tournament ends, and which
// processed games a player has already seen. Schema only.
const STAFF = '@request.auth.role = "admin" || @request.auth.role = "moderator"';

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
		const tournaments = addMissing(app, 'tournaments', [json('tournaments', 'roundDeadlines')]);
		const matches = addMissing(app, 'tournament_matches', [
			date('tournament_matches', 'deadline'),
			date('tournament_matches', 'overdueNotifiedAt')
		]);
		const participants = addMissing(app, 'tournament_participants', [
			json('tournament_participants', 'seenGames')
		]);
		addMissing(app, 'hidden_matches', [
			relation('hidden_matches', 'tournament', tournaments.id, true)
		]);

		const live = addMissing(app, 'lobbies_live', [
			{
				hidden: false,
				id: 'bool_lobbies_live_is_hidden',
				name: 'isHidden',
				presentable: false,
				required: false,
				system: false,
				type: 'bool'
			}
		]);
		const liveRule = `isHidden = false || ${STAFF}`;
		if (live.listRule !== liveRule) {
			live.listRule = liveRule;
			live.viewRule = liveRule;
			app.save(live);
		}

		try {
			app.findCollectionByNameOrId('tournament_claims');
			return;
		} catch {
			// create below
		}

		const c = 'tournament_claims';
		app.save(
			new Collection({
				createRule: null,
				deleteRule: null,
				updateRule: null,
				listRule: null,
				viewRule: null,
				name: c,
				type: 'base',
				indexes: [
					'CREATE INDEX `idx_tournament_claims_match` ON `tournament_claims` (`match`, `status`)',
					'CREATE UNIQUE INDEX `idx_tournament_claims_session` ON `tournament_claims` (`sessionId`) WHERE `sessionId` > 0'
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
					relation(c, 'match', matches.id, true),
					relation(c, 'participant', participants.id, true),
					relation(c, 'user', '_pb_users_auth_', true),
					{
						hidden: false,
						id: `number_${c}_sessionId`,
						max: null,
						min: null,
						name: 'sessionId',
						onlyInt: true,
						presentable: false,
						required: false,
						system: false,
						type: 'number'
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: `text_${c}_lobby`,
						max: 15,
						min: 0,
						name: 'lobby',
						pattern: '',
						presentable: false,
						primaryKey: false,
						required: false,
						system: false,
						type: 'text'
					},
					{
						hidden: false,
						id: `select_${c}_status`,
						maxSelect: 1,
						name: 'status',
						presentable: false,
						required: true,
						system: false,
						type: 'select',
						values: ['armed', 'playing', 'counted', 'void']
					},
					date(c, 'armedAt'),
					date(c, 'processedAt'),
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
			app.delete(app.findCollectionByNameOrId('tournament_claims'));
		} catch {
			// already gone
		}

		for (const [name, fields] of [
			['tournaments', ['roundDeadlines']],
			['tournament_matches', ['deadline', 'overdueNotifiedAt']],
			['tournament_participants', ['seenGames']],
			['hidden_matches', ['tournament']],
			['lobbies_live', ['isHidden']]
		]) {
			const collection = app.findCollectionByNameOrId(name);
			for (const field of fields) {
				collection.fields.removeByName(field);
			}

			if (name === 'lobbies_live') {
				collection.listRule = '';
				collection.viewRule = '';
			}

			app.save(collection);
		}
	}
);
