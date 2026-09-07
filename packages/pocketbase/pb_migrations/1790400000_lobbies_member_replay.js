/// <reference path="../pb_data/types.d.ts" />

// Schema-only text link from lobbies → member replay id (not a relation — avoids
// relation sync on the large lobbies table).
const MEMBER_REPLAY_FIELD = {
	autogeneratePattern: '',
	hidden: false,
	id: 'text_lobbies_member_replay',
	max: 100,
	min: 0,
	name: 'memberReplay',
	pattern: '',
	presentable: false,
	primaryKey: false,
	required: false,
	system: false,
	type: 'text'
};

function lobbiesHasSqlColumn(app) {
	const rows = arrayOf(new DynamicModel({ name: '' }));
	app
		.db()
		.newQuery("SELECT name FROM pragma_table_info('lobbies') WHERE name='memberReplay'")
		.all(rows);
	return rows.length > 0;
}

function registerMemberReplayFieldMetadata(app) {
	const row = new DynamicModel({ fields: '' });
	app.db().newQuery("SELECT fields FROM _collections WHERE name='lobbies'").one(row);
	const fields = JSON.parse(row.fields || '[]');
	if (fields.some((field) => field.name === 'memberReplay' || field.id === MEMBER_REPLAY_FIELD.id)) {
		return;
	}

	fields.push(MEMBER_REPLAY_FIELD);
	app
		.db()
		.newQuery('UPDATE _collections SET fields={:fields} WHERE name={:name}')
		.bind({ fields: JSON.stringify(fields), name: 'lobbies' })
		.execute();
}

migrate(
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		if (lobbies.fields.getByName('memberReplay')) {
			return;
		}

		// A previous apply ALTER'd the SQL column then failed on app.save()'s rename.
		// Column is already present — register collection metadata only.
		if (lobbiesHasSqlColumn(app)) {
			registerMemberReplayFieldMetadata(app);
			return;
		}

		lobbies.fields.add(new Field(MEMBER_REPLAY_FIELD));
		app.save(lobbies);
	},
	(app) => {
		try {
			const lobbies = app.findCollectionByNameOrId('lobbies');
			if (lobbies.fields.getByName('memberReplay')) {
				lobbies.fields.removeByName('memberReplay');
				app.save(lobbies);
			}
		} catch {
			// already gone
		}
	}
);
