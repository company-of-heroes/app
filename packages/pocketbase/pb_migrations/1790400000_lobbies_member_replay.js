/// <reference path="../pb_data/types.d.ts" />

// Schema-only text link from lobbies → member replay id.
// Prefer ALTER + field metadata; avoid relation sync on the large lobbies table.
migrate(
	(app) => {
		try {
			app.db().newQuery("ALTER TABLE lobbies ADD COLUMN memberReplay TEXT DEFAULT ''").execute();
		} catch (error) {
			const message = String(error?.message || error);
			if (!/duplicate column|already exists/i.test(message)) {
				console.warn('[migrate] lobbies.memberReplay column', message);
			}
		}

		const lobbies = app.findCollectionByNameOrId('lobbies');
		if (lobbies.fields.getByName('memberReplay')) {
			return;
		}

		lobbies.fields.add(
			new Field({
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
			})
		);
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
