/// <reference path="../pb_data/types.d.ts" />

function collectProfileIds(row) {
	const profileIds = new Set();

	if (typeof row.lobbyPlayers === 'string' && row.lobbyPlayers.length > 2) {
		try {
			const parsed = JSON.parse(row.lobbyPlayers);
			if (Array.isArray(parsed)) {
				for (const player of parsed) {
					if (player?.profile_id != null) {
						profileIds.add(Number(player.profile_id));
					}
				}
			}
		} catch {
			// ignore invalid JSON
		}
	}

	if (profileIds.size === 0 && typeof row.playerProfileIdsCsv === 'string' && row.playerProfileIdsCsv.length > 0) {
		for (const part of row.playerProfileIdsCsv.split(',')) {
			if (!part) {
				continue;
			}

			const profileId = Number(part);
			if (!Number.isNaN(profileId)) {
				profileIds.add(profileId);
			}
		}
	}

	if (profileIds.size === 0 && typeof row.players === 'string' && row.players.length > 2) {
		try {
			const parsed = JSON.parse(row.players);
			if (Array.isArray(parsed)) {
				for (const player of parsed) {
					const profileId = player?.profile?.profile_id;
					if (profileId != null) {
						profileIds.add(Number(profileId));
					}
				}
			}
		} catch {
			// ignore invalid JSON
		}
	}

	return profileIds;
}

migrate((app) => {
	let collection;

	try {
		collection = app.findCollectionByNameOrId('lobby_player_index');
	} catch {
		return;
	}

	const countRow = new DynamicModel({ total: 0 });

	try {
		app.db().newQuery('SELECT COUNT(*) AS total FROM lobby_player_index').one(countRow);

		if (Number(countRow.total) > 0) {
			return;
		}
	} catch {
		return;
	}

	const rows = arrayOf(
		new DynamicModel({
			id: '',
			lobbyPlayers: '',
			players: '',
			playerProfileIdsCsv: ''
		})
	);

	app
		.db()
		.newQuery(
			`SELECT
				id,
				COALESCE(lobbyPlayers, '') AS lobbyPlayers,
				COALESCE(players, '') AS players,
				COALESCE(playerProfileIdsCsv, '') AS playerProfileIdsCsv
			FROM lobbies`
		)
		.all(rows);

	for (const row of rows) {
		const profileIds = collectProfileIds(row);

		for (const profileId of profileIds) {
			if (Number.isNaN(profileId)) {
				continue;
			}

			const record = new Record(collection);
			record.set('lobby', row.id);
			record.set('profile_id', profileId);

			try {
				app.save(record);
			} catch {
				// duplicate lobby/profile pair
			}
		}
	}
}, () => {});
