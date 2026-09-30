/// <reference path="../pb_data/types.d.ts" />

// Schema-only: replay file duration/size for attach comparison (not Relic match duration).
// Avoid app.save(lobbies) — it rewrites the huge lobbies table and blocks Server started.
// Same pattern as 1790400000_lobbies_member_replay.js (ALTER + _collections metadata).

const REPLAY_DURATION_FIELD = {
	hidden: false,
	id: 'number_lobby_replay_duration_seconds',
	max: null,
	min: 0,
	name: 'replayDurationSeconds',
	onlyInt: true,
	presentable: false,
	required: false,
	system: false,
	type: 'number'
};

const REPLAY_BYTES_FIELD = {
	hidden: false,
	id: 'number_lobby_replay_bytes',
	max: null,
	min: 0,
	name: 'replayBytes',
	onlyInt: true,
	presentable: false,
	required: false,
	system: false,
	type: 'number'
};

function hasSqlColumn(app, name) {
	const rows = arrayOf(new DynamicModel({ name: '' }));
	app
		.db()
		.newQuery("SELECT name FROM pragma_table_info('lobbies') WHERE name={:name}")
		.bind({ name })
		.all(rows);
	return rows.length > 0;
}

function registerFieldMetadata(app, field) {
	const row = new DynamicModel({ fields: '' });
	app.db().newQuery("SELECT fields FROM _collections WHERE name='lobbies'").one(row);
	const fields = JSON.parse(row.fields || '[]');
	if (fields.some((entry) => entry.name === field.name || entry.id === field.id)) {
		return;
	}

	fields.push(field);
	app
		.db()
		.newQuery('UPDATE _collections SET fields={:fields} WHERE name={:name}')
		.bind({ fields: JSON.stringify(fields), name: 'lobbies' })
		.execute();
}

function ensureNumberColumn(app, field) {
	if (!hasSqlColumn(app, field.name)) {
		// SQLite ADD COLUMN is cheap; does not rewrite the table.
		app
			.db()
			.newQuery(`ALTER TABLE lobbies ADD COLUMN \`${field.name}\` NUMERIC DEFAULT NULL`)
			.execute();
	}

	registerFieldMetadata(app, field);
}

migrate(
	(app) => {
		ensureNumberColumn(app, REPLAY_DURATION_FIELD);
		ensureNumberColumn(app, REPLAY_BYTES_FIELD);
	},
	(app) => {
		// Downgrade: drop metadata only. SQLite cannot DROP COLUMN cheaply on this table size.
		const row = new DynamicModel({ fields: '' });
		try {
			app.db().newQuery("SELECT fields FROM _collections WHERE name='lobbies'").one(row);
			const fields = JSON.parse(row.fields || '[]').filter(
				(entry) =>
					entry.name !== REPLAY_DURATION_FIELD.name &&
					entry.name !== REPLAY_BYTES_FIELD.name &&
					entry.id !== REPLAY_DURATION_FIELD.id &&
					entry.id !== REPLAY_BYTES_FIELD.id
			);
			app
				.db()
				.newQuery('UPDATE _collections SET fields={:fields} WHERE name={:name}')
				.bind({ fields: JSON.stringify(fields), name: 'lobbies' })
				.execute();
		} catch {
			// already gone
		}
	}
);
